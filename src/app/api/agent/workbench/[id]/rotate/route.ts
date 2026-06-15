import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { degrees, PDFDocument } from 'pdf-lib';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  delta: z.union([z.literal(90), z.literal(-90)]),
  /** 회전할 페이지 (1-base). 그 페이지만 회전. */
  page: z.coerce.number().int().min(1),
  /** 부속(해설지) 회전이면 그 부속 id. 없으면 본 PDF. */
  attachmentId: z.string().uuid().optional(),
  /**
   * 레거시 전체회전(메타데이터) 마이그레이션: 0이 아니면 먼저 모든 페이지에
   * 이 값을 구워 넣어 화면과 파일을 맞춘 뒤 page에 delta를 추가한다.
   */
  baseRotation: z.coerce.number().int().optional(),
});

/**
 * 본/부속 PDF의 **해당 페이지**를 delta(±90°)만큼 파일에 구워 다시 저장한다.
 * 페이지별 /Rotate에 누적, 같은 Storage 경로로 덮어쓰고(캐시 무효화) 새 서명
 * URL 반환. 회전 메타데이터는 0으로 리셋(파일에 영속).
 */
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
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: 'invalid body' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data: job } = await supabase
    .from('workbench_jobs')
    .select('id, source_id')
    .eq('id', id)
    .maybeSingle();
  if (!job) return NextResponse.json({ message: 'not found' }, { status: 404 });

  // 회전 대상 파일 경로 — 부속이면 그 부속, 아니면 본 소스.
  let filePath: string | null = null;
  if (body.attachmentId) {
    const { data: att } = await supabase
      .from('workbench_attachments')
      .select('id, file_path')
      .eq('id', body.attachmentId)
      .eq('job_id', id)
      .maybeSingle();
    filePath = att?.file_path ?? null;
  } else {
    const { data: source } = await supabase
      .from('sources')
      .select('id, file_path')
      .eq('id', job.source_id)
      .maybeSingle();
    filePath = source?.file_path ?? null;
  }
  if (!filePath) {
    return NextResponse.json({ message: 'PDF 파일이 없어요.' }, { status: 404 });
  }

  try {
    const { data: blob, error: dlErr } = await supabase.storage
      .from('sources')
      .download(filePath);
    if (dlErr || !blob) throw new Error(dlErr?.message ?? 'PDF 다운로드 실패');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = pdf.getPages();
    if (!pages[body.page - 1]) {
      return NextResponse.json({ message: '없는 페이지예요.' }, { status: 400 });
    }
    const base = ((((body.baseRotation ?? 0) % 360) + 360) % 360);
    pages.forEach((p, i) => {
      const extra = i === body.page - 1 ? body.delta : 0;
      // 레거시 전체회전(base)을 모든 페이지에 굽고, 대상 페이지엔 delta 추가.
      if (base === 0 && extra === 0) return;
      const cur = p.getRotation().angle;
      p.setRotation(degrees((((cur + base + extra) % 360) + 360) % 360));
    });
    const out = await pdf.save();

    const { error: upErr } = await supabase.storage
      .from('sources')
      .upload(filePath, out, {
        contentType: 'application/pdf',
        upsert: true,
        cacheControl: '0',
      });
    if (upErr) throw new Error(upErr.message);

    // 파일에 구웠으니 회전 메타데이터는 0으로.
    if (body.attachmentId) {
      await supabase
        .from('workbench_attachments')
        .update({ rotation: 0 })
        .eq('id', body.attachmentId);
    } else {
      await supabase
        .from('workbench_jobs')
        .update({ rotation: 0, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    const { data: signed, error: sErr } = await supabase.storage
      .from('sources')
      .createSignedUrl(filePath, 60 * 60);
    if (sErr || !signed) throw new Error(sErr?.message ?? '서명 URL 실패');

    return NextResponse.json({ pdfUrl: signed.signedUrl });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : 'PDF 회전 실패' },
      { status: 500 },
    );
  }
}
