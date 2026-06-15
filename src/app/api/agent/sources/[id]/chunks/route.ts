import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSourceChunks } from '@/entities/source/server';
import { getUploaderId, requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

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

/** PDF 워크벤치: 박스로 저장한 청크 1개 삭제 (?chunkId=). */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const chunkId = req.nextUrl.searchParams.get('chunkId') ?? '';
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(chunkId).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { error, count } = await supabase
    .from('source_chunks')
    .delete({ count: 'exact' })
    .eq('id', chunkId)
    .eq('source_id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (count) {
    const { data: src } = await supabase
      .from('sources')
      .select('chunk_count')
      .eq('id', id)
      .maybeSingle();
    await supabase
      .from('sources')
      .update({ chunk_count: Math.max(0, (src?.chunk_count ?? 1) - 1) })
      .eq('id', id);
  }
  return NextResponse.json({ ok: true });
}

const figureSchema = z.object({
  url: z.string().url().max(1000),
  caption: z.string().max(500).optional(),
  explanation: z.string().max(4000).optional(),
});

const createChunkSchema = z.object({
  page_number: z.coerce.number().int().min(1),
  content: z.string().trim().min(10).max(20_000),
  chapter_path: z.array(z.string().min(1).max(80)).max(6).default([]),
  figures: z.array(figureSchema).max(10).default([]),
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

    const { data: maxRow } = await supabase
      .from('source_chunks')
      .select('chunk_index')
      .eq('source_id', id)
      .order('chunk_index', { ascending: false })
      .limit(1)
      .maybeSingle();
    const chunkIndex = (maxRow?.chunk_index ?? -1) + 1;

    // 임베딩은 저장과 분리 — embedding은 비워두고(=대기), 나중에 일괄 임베딩
    // (/api/agent/embeddings)에서 채운다. 저장 응답이 빨라진다.
    const { data: inserted, error: insErr } = await supabase
      .from('source_chunks')
      .insert({
        source_id: id,
        page_number: body.page_number,
        chunk_index: chunkIndex,
        content,
        chapter_path: chapterPath,
        figures: body.figures ?? [],
        embedding: null,
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
