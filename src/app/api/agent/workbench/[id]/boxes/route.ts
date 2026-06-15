import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

const rectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

const createSchema = z.object({
  page: z.coerce.number().int().min(1),
  rect: rectSchema,
  kind: z.enum(['problem', 'concept', 'passage']),
  status: z.enum(['idle', 'ocr', 'ready', 'failed', 'saved']).default('idle'),
  payload: z.record(z.string(), z.unknown()).default({}),
});

/** 박스 생성 (공동 작업·이어하기를 위해 서버에 영속). */
export async function POST(req: NextRequest, ctx: Ctx) {
  const uploader = await getUploader();
  if (!uploader) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  let body;
  try {
    body = createSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ message: 'invalid body', details: String(e) }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('workbench_boxes')
    .insert({
      job_id: id,
      page: body.page,
      rect: body.rect,
      kind: body.kind,
      status: body.status,
      payload: body.payload,
      created_by: uploader.id,
    })
    .select('id')
    .single();
  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'insert failed' }, { status: 500 });
  }
  await supabase
    .from('workbench_jobs')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id);
  return NextResponse.json({ id: data.id, actor: uploader.nickname }, { status: 201 });
}
