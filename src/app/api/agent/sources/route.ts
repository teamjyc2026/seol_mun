import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  listSources,
  type ListSourcesFilters,
} from '@/entities/source/api/listSources';
import {
  SOURCE_TYPES,
  GRADES,
  type IndexingStatus,
  type SourceType,
} from '@/entities/source/model/types';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { indexSource } from '@/shared/agent/indexSource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const metadataSchema = z.object({
  title: z.string().min(1).max(200),
  source_type: z.enum(SOURCE_TYPES),
  subject: z.string().min(1).max(50).default('국사'),
  subjects: z.array(z.string().min(1).max(50)).max(20).optional(),
  grade: z.enum(GRADES).nullable().optional(),
  publisher: z.string().max(100).nullable().optional(),
  year: z.coerce.number().int().min(1900).max(2100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  author: z.string().max(100).nullable().optional(),
  edition: z.string().max(100).nullable().optional(),
  isbn: z.string().max(40).nullable().optional(),
  units: z.array(z.string().min(1).max(80)).max(40).optional(),
  tags: z.array(z.string().min(1).max(40)).max(40).optional(),
});

const MAX_BYTES = 50 * 1024 * 1024;

function csvToArray(input: string | undefined | null): string[] {
  if (!input) return [];
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const filters: ListSourcesFilters = {
    search: url.searchParams.get('search') ?? undefined,
    subject: url.searchParams.get('subject') ?? undefined,
    grade: url.searchParams.get('grade') ?? undefined,
    source_type: (url.searchParams.get('source_type') as SourceType | null) ?? undefined,
    status:
      (url.searchParams.get('status') as IndexingStatus | null) ?? undefined,
  };
  try {
    const rows = await listSources(filters);
    return NextResponse.json({ sources: rows });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : 'error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireUploader())) {
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

  const subjectsCsv = csvToArray(form!.get('subjects')?.toString());
  const rawMeta = {
    title: form!.get('title')?.toString() ?? file.name.replace(/\.pdf$/i, ''),
    source_type: form!.get('source_type')?.toString(),
    subject:
      form!.get('subject')?.toString() ||
      (subjectsCsv[0] ?? '국사'),
    subjects: subjectsCsv.length ? subjectsCsv : undefined,
    grade: form!.get('grade')?.toString() || undefined,
    publisher: form!.get('publisher')?.toString() || null,
    year: form!.get('year')?.toString() || undefined,
    description: form!.get('description')?.toString() || null,
    author: form!.get('author')?.toString() || null,
    edition: form!.get('edition')?.toString() || null,
    isbn: form!.get('isbn')?.toString() || null,
    units: csvToArray(form!.get('units')?.toString()),
    tags: csvToArray(form!.get('tags')?.toString()),
  };

  let meta;
  try {
    meta = metadataSchema.parse(rawMeta);
  } catch (e) {
    return NextResponse.json(
      { message: '메타데이터가 올바르지 않습니다.', details: String(e) },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  const id = crypto.randomUUID();
  const path = `${id}.pdf`;

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
        subjects: meta.subjects ?? [meta.subject],
        grade: meta.grade ?? null,
        publisher: meta.publisher ?? null,
        year: meta.year ?? null,
        description: meta.description ?? null,
        author: meta.author ?? null,
        edition: meta.edition ?? null,
        isbn: meta.isbn ?? null,
        units: meta.units ?? [],
        tags: meta.tags ?? [],
        file_path: path,
        original_filename: file.name,
        file_size_bytes: file.size,
        indexing_status: 'pending',
      })
      .select('id')
      .single();
    if (insErr || !row) {
      await supabase.storage.from('sources').remove([path]).catch(() => undefined);
      return NextResponse.json(
        { message: 'DB 저장 실패', details: insErr?.message },
        { status: 500 },
      );
    }

    try {
      const result = await indexSource(row.id);
      return NextResponse.json({ id: row.id, ...result }, { status: 201 });
    } catch (e) {
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
