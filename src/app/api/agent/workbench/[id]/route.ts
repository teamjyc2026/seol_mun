import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

/** 작업 상세: 소스 메타 + 서명된 PDF URL(문제지/답안지) + 저장된 박스 전부. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { data: job } = await supabase
    .from('workbench_jobs')
    .select('id, source_id, title, answer_path, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (!job) return NextResponse.json({ message: 'not found' }, { status: 404 });

  const { data: source } = await supabase
    .from('sources')
    .select('id, title, subject, grade, file_path')
    .eq('id', job.source_id)
    .maybeSingle();
  if (!source?.file_path) {
    return NextResponse.json({ message: '소스 PDF가 없어요.' }, { status: 404 });
  }

  const [{ data: pdfSigned, error: pdfErr }, answerSigned, { data: boxes }] =
    await Promise.all([
      supabase.storage.from('sources').createSignedUrl(source.file_path, 60 * 60),
      job.answer_path
        ? supabase.storage.from('sources').createSignedUrl(job.answer_path, 60 * 60)
        : Promise.resolve(null),
      supabase
        .from('workbench_boxes')
        .select('id, page, rect, kind, status, payload, saved_ref, updated_at')
        .eq('job_id', id)
        .order('created_at', { ascending: true }),
    ]);
  if (pdfErr || !pdfSigned) {
    return NextResponse.json({ message: pdfErr?.message ?? 'signed url 실패' }, { status: 500 });
  }

  return NextResponse.json({
    job: { id: job.id, title: job.title, hasAnswerPdf: !!job.answer_path },
    source: {
      id: source.id,
      title: source.title,
      subject: source.subject,
      grade: source.grade,
    },
    pdfUrl: pdfSigned.signedUrl,
    answerPdfUrl: answerSigned?.data?.signedUrl ?? null,
    boxes: boxes ?? [],
  });
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  /** 답안 PDF의 Storage 경로 (upload-url로 업로드 후 연결). */
  answer_path: z.string().regex(/^[0-9a-f-]{36}\.pdf$/i).nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
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
    .from('workbench_jobs')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** 작업 삭제 — 저장된 문제·청크·소스는 유지되고 작업판(박스)만 사라진다. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('workbench_jobs').delete().eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
