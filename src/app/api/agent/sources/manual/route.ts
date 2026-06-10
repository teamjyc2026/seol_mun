import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { embedTexts } from '@/shared/lib/embedding';
import { splitWithOverlap } from '@/shared/lib/chunk';
import { buildEmbeddingText, type EmbedMeta } from '@/shared/agent/buildEmbeddingText';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(50),
  subjects: z.array(z.string()).optional(),
  grade: z.string().trim().max(10).optional(),
  source_type: z.string().trim().min(1).max(20),
  publisher: z.string().trim().max(100).optional(),
  units: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().trim().max(1000).optional(),
  schoolId: z.string().uuid().nullable().optional(),
  /** 직접 기입한 본문 텍스트 (OCR 인식 결과 포함 가능) */
  content: z.string().trim().min(40).max(500_000),
});

function sanitize(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c === 0x09 || c === 0x0a || c === 0x0d) {
      out += ch;
      continue;
    }
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f)) continue;
    if (c >= 0xd800 && c <= 0xdfff) continue;
    out += ch;
  }
  return out;
}

/** 교재를 PDF 업로드 없이 텍스트 직접 기입으로 등록 (즉시 청크+임베딩). */
export async function POST(req: NextRequest) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = schema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: '입력값을 확인해 주세요. (본문 40자 이상)', details: String(e) },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  const { data: src, error: insErr } = await supabase
    .from('sources')
    .insert({
      title: body.title,
      subject: body.subject,
      subjects: body.subjects?.length ? body.subjects : [body.subject],
      grade: body.grade ?? null,
      source_type: body.source_type,
      publisher: body.publisher ?? null,
      units: body.units ?? [],
      tags: body.tags ?? [],
      description: body.description ?? null,
      file_path: null,
      original_filename: null,
      indexing_status: 'processing',
      school_id: body.schoolId ?? null,
    })
    .select('id')
    .single();
  if (insErr || !src) {
    return NextResponse.json(
      { message: insErr?.message ?? 'source insert failed' },
      { status: 500 },
    );
  }
  const sourceId = src.id as string;

  try {
    const text = sanitize(body.content);
    const split = splitWithOverlap(text, { size: 800, overlap: 100 });
    const meta: EmbedMeta = {
      subject: body.subject,
      grade: body.grade ?? null,
      publisher: body.publisher ?? null,
      edition: null,
      author: null,
      source_type: body.source_type,
      bookKeywords: body.units ?? [],
      tags: body.tags ?? [],
      title: body.title,
    };
    const rows = split.map((c, i) => ({
      source_id: sourceId,
      page_number: 1,
      chunk_index: i,
      content: c.text,
      chapter_path: [] as string[],
    }));
    const embeddings = await embedTexts(
      rows.map((r) => buildEmbeddingText({ ...meta, page: 1, chapterPath: [] }, r.content)),
    );
    const toInsert = rows.map((r, i) => ({
      ...r,
      embedding: embeddings[i] as unknown as string,
    }));
    for (let i = 0; i < toInsert.length; i += 200) {
      const { error } = await supabase
        .from('source_chunks')
        .insert(toInsert.slice(i, i + 200));
      if (error) throw new Error(error.message);
    }
    await supabase
      .from('sources')
      .update({
        total_pages: 1,
        chunk_count: rows.length,
        text_density: text.length,
        needs_ocr: false,
        indexing_status: 'ready',
        indexing_error: null,
        indexed_at: new Date().toISOString(),
      })
      .eq('id', sourceId);
    return NextResponse.json({ id: sourceId, chunks: rows.length }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from('sources')
      .update({ indexing_status: 'failed', indexing_error: msg })
      .eq('id', sourceId);
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
