import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { runAgentTools, streamWrapup } from '@/shared/agent/router';
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
});

function encodeEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
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
        const { augmentedMessage, toolResults, citations, directText } =
          await runAgentTools({
            conversationId: convId,
            message: body.message,
            pinnedSourceIds: body.pinnedSourceIds,
            studentId: body.studentId ?? null,
            subject,
          });

        send({
          kind: 'meta',
          conversationId: convId,
          toolResults,
          citations,
        });

        let finalText = '';
        for await (const piece of streamWrapup({
          augmentedMessage,
          toolResults,
          initialText: directText,
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
            toolResults,
            citations,
            subject,
          },
        });

        send({ kind: 'done' });
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
