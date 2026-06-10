import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import type Anthropic from '@anthropic-ai/sdk';
import { runAgentTools, streamWrapup } from '@/shared/agent/router';
import { extractAndSaveMemories } from '@/shared/agent/memory';
import type { AgentId } from '@/shared/agent/agents/types';
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
    const content = r.content as { text?: string; agent?: AgentId } | null;
    const text = (content?.text ?? '').slice(0, HISTORY_TURN_CHARS).trim();
    if (!text) continue;
    if (r.role !== 'user' && r.role !== 'assistant') continue;
    // Claude requires the first message to be a user turn.
    if (history.length === 0 && r.role === 'assistant') continue;
    history.push({ role: r.role, content: text });
    if (r.role === 'assistant' && content?.agent) lastAgent = content.agent;
  }
  return { history, lastAgent };
}

export async function POST(req: NextRequest) {
  if (!(await requireUploader())) {
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

  let conversationId = body.conversationId ?? null;
  // Load prior turns BEFORE inserting the current user message.
  const { history, lastAgent } = conversationId
    ? await loadHistory(supabase, conversationId)
    : { history: [] as Anthropic.MessageParam[], lastAgent: null };
  if (!conversationId) {
    const title = body.message.slice(0, 30);
    const { data: conv, error } = await supabase
      .from('agent_conversations')
      .insert({ title })
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
    student_id: body.studentId ?? null,
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
        // This route is uploader-gated → always the teacher audience.
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
          studentId: body.studentId ?? null,
          subject,
          audience: 'teacher',
          schoolId: body.schoolId ?? null,
          history,
          lastAgent,
        });

        send({
          kind: 'meta',
          conversationId: convId,
          agent,
          toolResults,
          citations,
        });

        let finalText = '';
        for await (const piece of streamWrapup({
          augmentedMessage,
          toolResults,
          initialText: directText,
          subject,
          profile,
          audience: 'teacher',
          studentId: body.studentId ?? null,
          schoolName,
          history,
        })) {
          finalText += piece;
          send({ kind: 'token', text: piece });
        }
        if (!finalText) {
          finalText = '결과를 정리하지 못했어요.';
          send({ kind: 'token', text: finalText });
        }

        await supabase.from('agent_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: {
            text: finalText,
            agent,
            toolResults,
            citations,
            subject,
          },
        });

        send({ kind: 'done' });

        // Memory-enabled profiles (companion/emotion): remember facts from
        // this turn. Runs after 'done' so the UI never waits on it.
        if (profile.useMemories) {
          await extractAndSaveMemories({
            studentId: body.studentId ?? null,
            agent,
            userMessage: body.message,
            assistantText: finalText,
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
