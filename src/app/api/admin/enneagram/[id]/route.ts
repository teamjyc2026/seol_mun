import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAdmin } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('enneagram_responses')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('[DELETE /api/admin/enneagram/:id] supabase error', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
