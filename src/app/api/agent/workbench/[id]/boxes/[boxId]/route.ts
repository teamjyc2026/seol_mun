import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string; boxId: string }> };

const patchSchema = z.object({
  rect: z
    .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
    .optional(),
  kind: z.enum(['problem', 'concept', 'passage']).optional(),
  status: z.enum(['ocr', 'ready', 'failed', 'saved']).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  saved_ref: z.string().uuid().nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id, boxId } = await ctx.params;
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(boxId).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  let body;
  try {
    body = patchSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ message: 'invalid body', details: String(e) }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('workbench_boxes')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', boxId)
    .eq('job_id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  await supabase
    .from('workbench_jobs')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id, boxId } = await ctx.params;
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(boxId).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('workbench_boxes')
    .delete()
    .eq('id', boxId)
    .eq('job_id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
