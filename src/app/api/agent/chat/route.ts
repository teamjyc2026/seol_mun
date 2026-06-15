import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getStudent, requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import type Anthropic from '@anthropic-ai/sdk';
import { runAgentTools, streamWrapup } from '@/shared/agent/router';
import { extractAndSaveMemories } from '@/shared/agent/memory';
import { maskProblemAnswers } from '@/shared/agent/maskAnswers';
import { parseQuickReplies } from '@/shared/agent/quickReplies';
import { parseSolveStage } from '@/shared/agent/solveStage';
import type { AgentId } from '@/shared/agent/agents/types';
import type { ToolResult } from '@/shared/agent/types';
import { DEFAULT_SUBJECT } from '@/shared/config/subjects';
import type { StreamEvent } from '@/shared/agent/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const schema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().min(1).max(4000),
  pinnedSourceIds: z.array(z.string().uuid()).default([]),
  studentId: z.string().min(1).optional(),
  subject: z.string().min(1).max(50).optional(),
  schoolId: z.string().uuid().nullable().optional(),
});

function encodeEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

const HISTORY_TURNS = 12;
const HISTORY_TURN_CHARS = 3000;

/**
 * Load prior turns of this conversation as Claude messages, plus the
 * specialist that handled the last assistant turn (sticky tutoring loop).
 */
async function loadHistory(
  supabase: ReturnType<typeof getSupabaseServer>,
  conversationId: string,
): Promise<{ history: Anthropic.MessageParam[]; lastAgent: AgentId | null }> {
  const { data } = await supabase
    .from('agent_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_TURNS);
  const rows = (data ?? []).reverse();

  const history: Anthropic.MessageParam[] = [];
  let lastAgent: AgentId | null = null;
  for (const r of rows) {
    const content = r.content as {
      text?: string;
      agent?: AgentId;
      toolResults?: ToolResult[];
      stage?: number;
    } | null;
    let text = (content?.text ?? '').slice(0, HISTORY_TURN_CHARS).trim();
    if (!text) continue;
    if (r.role !== 'user' && r.role !== 'assistant') continue;
    // Claude requires the first message to be a user turn.
    if (history.length === 0 && r.role === 'assistant') continue;
    if (r.role === 'assistant') {
      // 클라이언트에는 마스킹돼 나갔지만, 채점을 위해 그 턴에 출제된 문제의
      // 정답·해설을 모델에게만 비공개 메모로 전달한다.
      const problems = (content?.toolResults ?? []).flatMap((tr) =>
        tr.kind === 'search_problem' || tr.kind === 'generate_problem'
          ? tr.problems
          : [],
      );
      const notes = problems
        .filter((p) => p.answer)
        .slice(0, 5)
        .map(
          (p, i) =>
            `문제${i + 1} "${p.question.slice(0, 60)}" → 정답: ${p.answer}${
              p.explanation ? ` / 해설: ${String(p.explanation).slice(0, 300)}` : ''
            }`,
        );
      if (notes.length > 0) {
        text += `\n\n[비공개 채점 메모 — 학생 메시지에 답이 오기 전까지 절대 노출 금지]\n${notes.join('\n')}`;
      }
      // 단계 마커는 저장 전에 제거되므로, 풀이 코칭 연속성을 위해 메모로 복원.
      if (content?.stage != null) {
        text += `\n\n[비공개: 이 턴의 풀이 단계 = ${content.stage}]`;
      }
      if (content?.agent) lastAgent = content.agent;
    }
    history.push({ role: r.role, content: text });
  }
  return { history, lastAgent };
}

export async function POST(req: NextRequest) {
  // Two caller realms: uploader(교사/관리) or logged-in student(학습자).
  const isUploader = await requireUploader();
  const sessionStudent = isUploader ? null : await getStudent();
  const sessionStudentId = sessionStudent?.id ?? null;
  if (!isUploader && !sessionStudentId) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = schema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: 'invalid body', details: String(e) },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  const subject = body.subject || DEFAULT_SUBJECT;
  const audience = sessionStudentId ? 'student' : 'teacher';
  // Students are always tracked under their own id — body.studentId is the
  // teacher-side manual field only.
  const studentId = sessionStudentId ?? body.studentId ?? null;

  let conversationId = body.conversationId ?? null;
  if (conversationId && sessionStudentId) {
    // Students may only continue their own conversations.
    const { data: conv } = await supabase
      .from('agent_conversations')
      .select('id, student_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conv || conv.student_id !== sessionStudentId) {
      return NextResponse.json({ message: 'forbidden' }, { status: 403 });
    }
  }
  // Load prior turns BEFORE inserting the current user message.
  const { history, lastAgent } = conversationId
    ? await loadHistory(supabase, conversationId)
    : { history: [] as Anthropic.MessageParam[], lastAgent: null };
  if (!conversationId) {
    const title = body.message.slice(0, 30);
    const { data: conv, error } = await supabase
      .from('agent_conversations')
      .insert({ title, student_id: sessionStudentId })
      .select('id')
      .single();
    if (error || !conv) {
      return NextResponse.json(
        { message: 'conversation create failed', details: error?.message },
        { status: 500 },
      );
    }
    conversationId = conv.id as string;
  }

  await supabase.from('agent_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: { text: body.message, subject },
    pinned_source_ids: body.pinnedSourceIds,
    student_id: studentId,
  });

  const convId = conversationId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          // controller already closed
        }
      };
      try {
        const {
          augmentedMessage,
          toolResults,
          citations,
          directText,
          profile,
          agent,
          schoolName,
        } = await runAgentTools({
          conversationId: convId,
          message: body.message,
          pinnedSourceIds: body.pinnedSourceIds,
          studentId,
          subject,
          audience,
          schoolId: body.schoolId ?? null,
          history,
          lastAgent,
          studentGrade: sessionStudent?.grade ?? null,
        });

        // 출제 시 정답·해설은 클라이언트로 내려보내지 않는다(마스킹).
        // 원본은 아래 agent_messages 저장분에 남아 다음 턴 채점에 쓰인다.
        const maskedToolResults = maskProblemAnswers(toolResults);
        send({
          kind: 'meta',
          conversationId: convId,
          agent,
          toolResults: maskedToolResults,
          citations,
        });

        let finalText = '';
        for await (const piece of streamWrapup({
          augmentedMessage,
          toolResults,
          initialText: directText,
          subject,
          profile,
          audience,
          studentId,
          schoolName,
          history,
          studentGrade: sessionStudent?.grade ?? null,
        })) {
          finalText += piece;
          send({ kind: 'token', text: piece });
        }
        if (!finalText) {
          finalText = '결과를 정리하지 못했어요.';
          send({ kind: 'token', text: finalText });
        }

        // 학생 모드: {{단계:N}} 마커와 마지막 줄 [[선택지]] 트레일러를 분리해
        // 저장한다. 히스토리·리로드가 자동으로 깨끗해진다.
        const staged =
          audience === 'student'
            ? parseSolveStage(finalText)
            : { text: finalText, stage: null };
        const parsed =
          audience === 'student'
            ? parseQuickReplies(staged.text)
            : { text: finalText, choices: [] as string[] };

        await supabase.from('agent_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: {
            text: parsed.text,
            ...(parsed.choices.length ? { choices: parsed.choices } : {}),
            ...(staged.stage != null ? { stage: staged.stage } : {}),
            agent,
            toolResults,
            citations,
            subject,
          },
        });

        send({ kind: 'done', choices: parsed.choices, stage: staged.stage });

        // Memory extraction after 'done' (UI never waits on it):
        // - companion/emotion: social facts/jokes/feelings
        // - tutoring agents + identified student: strengths/weaknesses, so
        //   future turns can re-quiz weak areas.
        if (profile.useMemories) {
          await extractAndSaveMemories({
            studentId,
            agent,
            userMessage: body.message,
            assistantText: parsed.text,
            mode: 'social',
          });
        } else if (studentId) {
          await extractAndSaveMemories({
            studentId,
            agent,
            userMessage: body.message,
            assistantText: parsed.text,
            mode: 'learning',
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ kind: 'error', message: msg });
        await supabase.from('agent_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: { text: `에이전트 오류: ${msg}` },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
