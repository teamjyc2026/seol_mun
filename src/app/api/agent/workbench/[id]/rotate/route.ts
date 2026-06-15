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
});

/**
 * 본 PDF의 **해당 페이지**를 delta(±90°)만큼 원본 파일에 구워 다시 저장한다.
 * 그 페이지의 /Rotate에 delta를 누적하고 같은 Storage 경로로 덮어쓴 뒤(캐시
 * 무효화), 새 서명 URL을 돌려준다. (메타데이터가 아니라 파일에 영속 →
 * 어디서 열어도 그 페이지가 회전된 채로 보인다.)
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

  const { data: source } = await supabase
    .from('sources')
    .select('id, file_path')
    .eq('id', job.source_id)
    .maybeSingle();
  if (!source?.file_path) {
    return NextResponse.json({ message: '소스 PDF가 없어요.' }, { status: 404 });
  }

  try {
    const { data: blob, error: dlErr } = await supabase.storage
      .from('sources')
      .download(source.file_path);
    if (dlErr || !blob) throw new Error(dlErr?.message ?? 'PDF 다운로드 실패');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = pdf.getPages();
    const target = pages[body.page - 1];
    if (!target) {
      return NextResponse.json({ message: '없는 페이지예요.' }, { status: 400 });
    }
    const cur = target.getRotation().angle;
    target.setRotation(degrees((((cur + body.delta) % 360) + 360) % 360));
    const out = await pdf.save();

    const { error: upErr } = await supabase.storage
      .from('sources')
      .upload(source.file_path, out, {
        contentType: 'application/pdf',
        upsert: true,
        cacheControl: '0',
      });
    if (upErr) throw new Error(upErr.message);

    // 파일에 구웠으니 메타데이터 회전은 0으로 유지.
    await supabase
      .from('workbench_jobs')
      .update({ rotation: 0, updated_at: new Date().toISOString() })
      .eq('id', id);

    const { data: signed, error: sErr } = await supabase.storage
      .from('sources')
      .createSignedUrl(source.file_path, 60 * 60);
    if (sErr || !signed) throw new Error(sErr?.message ?? '서명 URL 실패');

    return NextResponse.json({ pdfUrl: signed.signedUrl });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : 'PDF 회전 실패' },
      { status: 500 },
    );
  }
}
