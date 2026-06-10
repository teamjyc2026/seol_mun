import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { maskProblemAnswers } from '@/shared/agent/maskAnswers';
import type { ToolResult } from '@/shared/agent/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('agent_messages')
    .select('id, role, content, pinned_source_ids, student_id, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  // 저장본에는 채점용 원본 정답이 있으므로, 클라이언트로 나갈 때 마스킹한다.
  const messages = (data ?? []).map((m) => {
    const content = m.content as { toolResults?: ToolResult[] } | null;
    if (!content?.toolResults) return m;
    return {
      ...m,
      content: { ...content, toolResults: maskProblemAnswers(content.toolResults) },
    };
  });
  return NextResponse.json({ messages });
}
