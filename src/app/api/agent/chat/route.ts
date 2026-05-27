import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from '@/shared/config/admin';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { runAgent } from '@/shared/agent/router';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const schema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().min(1).max(4000),
  pinnedSourceIds: z.array(z.string().uuid()).default([]),
  studentId: z.string().min(1).optional(),
});

async function requireAdmin() {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
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

  // resolve / create conversation
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

  // persist user message
  await supabase.from('agent_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: { text: body.message },
    pinned_source_ids: body.pinnedSourceIds,
    student_id: body.studentId ?? null,
  });

  try {
    const reply = await runAgent({
      conversationId,
      message: body.message,
      pinnedSourceIds: body.pinnedSourceIds,
      studentId: body.studentId ?? null,
    });

    await supabase.from('agent_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: {
        text: reply.text,
        toolResults: reply.toolResults,
        citations: reply.citations,
      },
    });

    return NextResponse.json({ conversationId, reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from('agent_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: { text: `에이전트 오류: ${msg}` },
    });
    return NextResponse.json(
      { message: '에이전트 실행 실패', details: msg },
      { status: 500 },
    );
  }
}
