import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
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
  if (!source) return NextResponse.json({ message: 'not found' }, { status: 404 });
  const { data, error } = await supabase.storage
    .from('sources')
    .createSignedUrl(source.file_path, 60 * 10);
  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'failed' }, { status: 500 });
  }
  return NextResponse.json({ url: data.signedUrl });
}
