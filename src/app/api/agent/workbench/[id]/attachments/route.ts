import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({
  /** upload-url로 업로드해 둔 Storage 경로. */
  path: z.string().regex(/^[0-9a-f-]{36}\.pdf$/i),
  title: z.string().trim().min(1).max(100),
});

/** 부속 PDF(답안지·해설 등) 연결. */
export async function POST(req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  let body;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: 'invalid body' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('workbench_attachments')
    .insert({ job_id: id, title: body.title, file_path: body.path })
    .select('id, title, file_path')
    .single();
  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'insert failed' }, { status: 500 });
  }
  await supabase
    .from('workbench_jobs')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id);
  const { data: signed, error: signErr } = await supabase.storage
    .from('sources')
    .createSignedUrl(data.file_path, 60 * 60);
  if (signErr || !signed) {
    return NextResponse.json({ message: signErr?.message ?? 'signed url 실패' }, { status: 500 });
  }
  return NextResponse.json(
    { attachment: { id: data.id, title: data.title, url: signed.signedUrl } },
    { status: 201 },
  );
}
