import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

const patchSchema = z.object({ rotation: z.number().int() });

/** 부속 PDF 회전값 저장. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id, attachmentId } = await ctx.params;
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(attachmentId).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  let body;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: 'invalid body' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('workbench_attachments')
    .update({ rotation: body.rotation })
    .eq('id', attachmentId)
    .eq('job_id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** 부속 PDF 삭제 — 이 부속을 가리키던 박스 링크(answerRef)도 함께 정리. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id, attachmentId } = await ctx.params;
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(attachmentId).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('workbench_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('job_id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const { data: linkedBoxes } = await supabase
    .from('workbench_boxes')
    .select('id, payload')
    .eq('job_id', id)
    .filter('payload->answerRef->>attachmentId', 'eq', attachmentId);
  const clearedBoxIds: string[] = [];
  for (const box of linkedBoxes ?? []) {
    const payload = { ...((box.payload ?? {}) as Record<string, unknown>) };
    delete payload.answerRef;
    const { error: upErr } = await supabase
      .from('workbench_boxes')
      .update({ payload, updated_at: new Date().toISOString() })
      .eq('id', box.id);
    if (!upErr) clearedBoxIds.push(box.id);
  }
  return NextResponse.json({ ok: true, clearedBoxIds });
}
