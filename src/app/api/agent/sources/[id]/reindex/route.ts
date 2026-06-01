import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { indexSource } from '@/shared/agent/indexSource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  await supabase.from('source_chunks').delete().eq('source_id', id);
  await supabase
    .from('sources')
    .update({ chunk_count: 0, indexed_at: null, indexing_status: 'pending', indexing_error: null })
    .eq('id', id);
  try {
    const result = await indexSource(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : 'error' },
      { status: 500 },
    );
  }
}
