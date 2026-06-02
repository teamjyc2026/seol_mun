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
import { getUploaderId } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { indexSource } from '@/shared/agent/indexSource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const metadataSchema = z.object({
  // Storage path produced by POST /agent/sources/upload-url — the browser
  // uploads the PDF straight to Supabase, so only the path reaches us here.
  path: z.string().regex(/^[0-9a-f-]{36}\.pdf$/i, 'invalid path'),
  original_filename: z.string().min(1).max(300),
  file_size_bytes: z.coerce.number().int().min(0).max(50 * 1024 * 1024).nullable().optional(),
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

export async function GET(req: NextRequest) {
  if (!(await getUploaderId())) {
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
  const uploaderId = await getUploaderId();
  if (!uploaderId) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = metadataSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { message: '메타데이터가 올바르지 않습니다.', details: parsed.error.message },
      { status: 400 },
    );
  }
  const meta = parsed.data;

  const supabase = getSupabaseServer();
  const id = meta.path.replace(/\.pdf$/i, '');
  const path = meta.path;

  try {
    // Confirm the browser actually uploaded the object to the signed path.
    const { data: head, error: headErr } = await supabase.storage
      .from('sources')
      .info(path);
    if (headErr || !head) {
      return NextResponse.json(
        { message: '업로드된 파일을 찾을 수 없습니다. 다시 시도해 주세요.', details: headErr?.message },
        { status: 400 },
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
        original_filename: meta.original_filename,
        file_size_bytes: meta.file_size_bytes ?? head.size ?? null,
        indexing_status: 'pending',
        created_by: uploaderId,
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
