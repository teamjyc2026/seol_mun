import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { nicknamesByIds } from '@/shared/api/authors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

/** 작업 상세: 소스 메타 + 서명된 PDF URL(문제지/부속자료들) + 저장된 박스 전부. */
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
    .select('id, source_id, title, page_rotations, created_at, updated_at')
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

  const [{ data: pdfSigned, error: pdfErr }, { data: attRows }, { data: boxes }] =
    await Promise.all([
      supabase.storage.from('sources').createSignedUrl(source.file_path, 60 * 60),
      supabase
        .from('workbench_attachments')
        .select('id, title, file_path, page_rotations')
        .eq('job_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('workbench_boxes')
        .select('id, page, rect, kind, status, payload, saved_ref, created_by, updated_at')
        .eq('job_id', id)
        .order('created_at', { ascending: true }),
    ]);
  if (pdfErr || !pdfSigned) {
    return NextResponse.json({ message: pdfErr?.message ?? 'signed url 실패' }, { status: 500 });
  }

  const attachments = await Promise.all(
    (attRows ?? []).map(async (a) => {
      const { data: signed } = await supabase.storage
        .from('sources')
        .createSignedUrl(a.file_path, 60 * 60);
      return {
        id: a.id,
        title: a.title,
        url: signed?.signedUrl ?? null,
        pageRotations: a.page_rotations ?? {},
      };
    }),
  );

  // 박스별 올린이(created_by) 닉네임 해석.
  const nickMap = await nicknamesByIds((boxes ?? []).map((b) => b.created_by));
  const boxesWithActor = (boxes ?? []).map((b) => ({
    ...b,
    actor: b.created_by ? (nickMap.get(b.created_by) ?? null) : null,
  }));

  return NextResponse.json({
    job: { id: job.id, title: job.title, pageRotations: job.page_rotations ?? {} },
    source: {
      id: source.id,
      title: source.title,
      subject: source.subject,
      grade: source.grade,
    },
    pdfUrl: pdfSigned.signedUrl,
    attachments: attachments.filter((a) => a.url),
    boxes: boxesWithActor,
  });
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  /** 폴더 이동 (null = 미분류). */
  folder_id: z.string().uuid().nullable().optional(),
  /** 페이지별 회전 메타데이터 (page→deg). */
  page_rotations: z.record(z.string(), z.number().int()).optional(),
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
