import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data: source } = await supabase
    .from('sources')
    .select('id, file_path')
    .eq('id', id)
    .maybeSingle();
  if (!source) {
    return NextResponse.json({ message: 'not found' }, { status: 404 });
  }

  await supabase.storage.from('sources').remove([source.file_path]).catch(() => undefined);
  const { error } = await supabase.from('sources').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
