import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSourceChunks } from '@/entities/source/api/getSourceChunks';
import { getUploaderId, requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { embedQuery } from '@/shared/lib/embedding';
import { buildEmbeddingText, type EmbedMeta } from '@/shared/agent/buildEmbeddingText';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  try {
    const chunks = await getSourceChunks(id);
    return NextResponse.json({ chunks });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : 'error' },
      { status: 500 },
    );
  }
}

const createChunkSchema = z.object({
  page_number: z.coerce.number().int().min(1),
  content: z.string().trim().min(10).max(20_000),
  chapter_path: z.array(z.string().min(1).max(80)).max(6).default([]),
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

/** PDF 워크벤치: 개념/본문 박스 1개를 청크로 적재 (임베딩 포함). */
export async function POST(req: NextRequest, ctx: Ctx) {
  const uploaderId = await getUploaderId();
  if (!uploaderId) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  let body;
  try {
    body = createChunkSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: '입력값을 확인해 주세요. (본문 10자 이상)', details: String(e) },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  const { data: source, error: srcErr } = await supabase
    .from('sources')
    .select(
      'id, title, subject, grade, publisher, edition, author, source_type, units, tags, chunk_count',
    )
    .eq('id', id)
    .maybeSingle();
  if (srcErr || !source) {
    return NextResponse.json({ message: '소스를 찾을 수 없어요.' }, { status: 404 });
  }

  try {
    const content = sanitize(body.content);
    const chapterPath = body.chapter_path.map(sanitize);
    const meta: EmbedMeta = {
      subject: source.subject,
      grade: source.grade,
      publisher: source.publisher,
      edition: source.edition,
      author: source.author,
      source_type: source.source_type,
      bookKeywords: source.units,
      tags: source.tags,
      title: source.title,
    };
    const embedding = await embedQuery(
      buildEmbeddingText({ ...meta, page: body.page_number, chapterPath }, content),
    );

    const { data: maxRow } = await supabase
      .from('source_chunks')
      .select('chunk_index')
      .eq('source_id', id)
      .order('chunk_index', { ascending: false })
      .limit(1)
      .maybeSingle();
    const chunkIndex = (maxRow?.chunk_index ?? -1) + 1;

    const { data: inserted, error: insErr } = await supabase
      .from('source_chunks')
      .insert({
        source_id: id,
        page_number: body.page_number,
        chunk_index: chunkIndex,
        content,
        chapter_path: chapterPath,
        embedding: embedding as unknown as string,
        created_by: uploaderId,
      })
      .select('id')
      .single();
    if (insErr || !inserted) throw new Error(insErr?.message ?? 'chunk insert failed');

    await supabase
      .from('sources')
      .update({
        chunk_count: (source.chunk_count ?? 0) + 1,
        indexed_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({ id: inserted.id, chunkIndex }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : '청크 저장 실패' },
      { status: 500 },
    );
  }
}
