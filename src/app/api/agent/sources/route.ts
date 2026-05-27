import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { listSources } from '@/entities/source/api/listSources';
import { SOURCE_TYPES, GRADES } from '@/entities/source/model/types';
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from '@/shared/config/admin';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { indexSource } from '@/shared/agent/indexSource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // long PDFs

async function requireAdmin() {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE;
}

const metadataSchema = z.object({
  title: z.string().min(1).max(200),
  source_type: z.enum(SOURCE_TYPES),
  subject: z.string().min(1).max(50).default('국사'),
  grade: z.enum(GRADES).nullable().optional(),
  publisher: z.string().max(100).nullable().optional(),
  year: z.coerce.number().int().min(1900).max(2100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
});

const MAX_BYTES = 50 * 1024 * 1024;

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  try {
    const rows = await listSources();
    return NextResponse.json({ sources: rows });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : 'error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: 'file is required (multipart)' },
      { status: 400 },
    );
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ message: 'PDF만 업로드 가능합니다.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { message: `파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB > 50MB).` },
      { status: 413 },
    );
  }

  const metaInput = {
    title: form!.get('title')?.toString() ?? file.name.replace(/\.pdf$/i, ''),
    source_type: form!.get('source_type')?.toString(),
    subject: form!.get('subject')?.toString() || '국사',
    grade: (form!.get('grade')?.toString() || null) as string | null,
    publisher: form!.get('publisher')?.toString() || null,
    year: form!.get('year')?.toString() || null,
    description: form!.get('description')?.toString() || null,
  };

  let meta;
  try {
    meta = metadataSchema.parse({
      ...metaInput,
      grade: metaInput.grade || undefined,
      year: metaInput.year || undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { message: '메타데이터가 올바르지 않습니다.', details: String(e) },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  const id = crypto.randomUUID();
  const ext = 'pdf';
  const path = `${id}.${ext}`;

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from('sources')
      .upload(path, buf, { contentType: 'application/pdf', upsert: false });
    if (upErr) {
      return NextResponse.json(
        { message: '스토리지 업로드 실패', details: upErr.message },
        { status: 500 },
      );
    }

    const { data: row, error: insErr } = await supabase
      .from('sources')
      .insert({
        id,
        title: meta.title,
        source_type: meta.source_type,
        subject: meta.subject,
        grade: meta.grade ?? null,
        publisher: meta.publisher ?? null,
        year: meta.year ?? null,
        description: meta.description ?? null,
        file_path: path,
        original_filename: file.name,
        file_size_bytes: file.size,
        indexing_status: 'pending',
      })
      .select('id')
      .single();
    if (insErr || !row) {
      // best-effort rollback of uploaded file
      await supabase.storage.from('sources').remove([path]).catch(() => undefined);
      return NextResponse.json(
        { message: 'DB 저장 실패', details: insErr?.message },
        { status: 500 },
      );
    }

    // synchronous indexing (MVP). For big files this may exceed maxDuration.
    try {
      const result = await indexSource(row.id);
      return NextResponse.json(
        { id: row.id, ...result },
        { status: 201 },
      );
    } catch (e) {
      // status is already set to 'failed' inside indexSource
      return NextResponse.json(
        {
          id: row.id,
          message: '업로드는 완료됐지만 인덱싱에 실패했어요.',
          details: e instanceof Error ? e.message : String(e),
        },
        { status: 207 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      { message: '서버 오류', details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
