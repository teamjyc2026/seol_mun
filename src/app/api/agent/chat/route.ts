import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getStudent, requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import type Anthropic from '@anthropic-ai/sdk';
import { llmErrorMessage } from '@/shared/config/anthropic';
import { runAgentTools, streamWrapup } from '@/shared/agent/router';
import { extractAndSaveMemories } from '@/shared/agent/memory';
import { gradeStudentAttempt } from '@/shared/agent/gradeAttempt';
import { summarizeAndEmbedConversation } from '@/shared/agent/roomMemory';
import { maskProblemAnswers } from '@/shared/agent/maskAnswers';
import { parseQuickReplies } from '@/shared/agent/quickReplies';
import { parseSolveStage } from '@/shared/agent/solveStage';
import type { AgentId } from '@/shared/agent/agents/types';
import type { ProblemDraft, ToolResult } from '@/shared/agent/types';
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
  scopeId: z.string().uuid().nullable().optional(),
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
): Promise<{
  history: Anthropic.MessageParam[];
  lastAgent: AgentId | null;
  /** 가장 최근 어시스턴트 턴에 출제된 (저장된) 문제 — 학생이 이번 턴에 답하는 대상. */
  servedProblems: ProblemDraft[];
}> {
  const { data } = await supabase
    .from('agent_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_TURNS);
  const rows = (data ?? []).reverse();

  const history: Anthropic.MessageParam[] = [];
  let lastAgent: AgentId | null = null;
  let servedProblems: ProblemDraft[] = [];
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
      // 학생은 "직전 어시스턴트 턴"에 나온 문제에 답한다 — 매 어시스턴트 턴마다
      // 갱신(문제 없는 턴이면 []로 리셋)해 가장 최근 턴의 출제만 채점 대상으로 둔다.
      servedProblems = problems;
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
  return { history, lastAgent, servedProblems };
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
  const { history, lastAgent, servedProblems } = conversationId
    ? await loadHistory(supabase, conversationId)
    : {
        history: [] as Anthropic.MessageParam[],
        lastAgent: null,
        servedProblems: [] as ProblemDraft[],
      };
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
          recalledRooms,
        } = await runAgentTools({
          conversationId: convId,
          message: body.message,
          pinnedSourceIds: body.pinnedSourceIds,
          studentId,
          subject,
          audience,
          schoolId: body.schoolId ?? null,
          scopeId: body.scopeId ?? null,
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
          recalledRooms,
        })) {
          finalText += piece;
          send({ kind: 'token', text: piece });
        }
        if (!finalText) {
          finalText = '결과를 정리하지 못했어요.';
          send({ kind: 'token', text: finalText });
        }

        // {{단계:N}} 마커와 마지막 줄 [[선택지]] 트레일러를 분리한다 — 오디언스 무관.
        // (교감/grok 페르소나는 teacher 모드에서도 [[선택지]]를 붙이므로 항상 정제해야
        //  플레이그라운드에 날것으로 새지 않는다.)
        const staged = parseSolveStage(finalText);
        const parsed = parseQuickReplies(staged.text);
        // 모델이 가끔 앞에 [잡담]/[교감] 같은 라벨을 붙인다 — 알려진 라벨이면 제거.
        const cleanText = parsed.text.replace(
          /^\s*\[(?:잡담|교감|감정|튜터|문법|어휘|독해|암기|문제|일반)\]\s*/u,
          '',
        );

        await supabase.from('agent_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: {
            text: cleanText,
            ...(parsed.choices.length ? { choices: parsed.choices } : {}),
            ...(staged.stage != null ? { stage: staged.stage } : {}),
            agent,
            toolResults,
            citations,
            subject,
          },
        });

        send({ kind: 'done', choices: parsed.choices, stage: staged.stage, text: cleanText });

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

        // 로그인 학생: 직전 턴에 출제된 문제에 대한 답이면 조용히 채점해
        // student_attempts에 기록(채팅엔 정답 노출 없음). 답이 아니면 기록 안 됨.
        if (sessionStudentId && servedProblems.length > 0) {
          const target = servedProblems.find((p) => p.id) ?? servedProblems[0];
          await gradeStudentAttempt({
            servedProblem: target,
            studentMessage: body.message,
            studentId: sessionStudentId,
            conversationId: convId,
            subject,
          });
        }
        // 로그인 학생 방: 요약·임베딩 갱신 → 다음 턴/방에서 관련 과거 방 회상.
        if (sessionStudentId) {
          await summarizeAndEmbedConversation({ conversationId: convId });
        }
      } catch (e) {
        const msg = llmErrorMessage(e);
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
