import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { embedTexts } from '@/shared/lib/embedding';
import { extractTextWithPages } from '@/shared/lib/pdf';
import { splitWithOverlap } from '@/shared/lib/chunk';

/**
 * Synchronous indexing: download from Storage, extract, chunk, embed, insert.
 * Updates the source row's status as it progresses.
 */
export async function indexSource(sourceId: string): Promise<{
  chunks: number;
  totalPages: number;
}> {
  const supabase = getSupabaseServer();

  await supabase
    .from('sources')
    .update({ indexing_status: 'processing', indexing_error: null })
    .eq('id', sourceId);

  const { data: source, error: srcErr } = await supabase
    .from('sources')
    .select('id, file_path')
    .eq('id', sourceId)
    .single();
  if (srcErr || !source) {
    throw new Error(srcErr?.message ?? 'source not found');
  }

  try {
    const { data: file, error: dlErr } = await supabase.storage
      .from('sources')
      .download(source.file_path);
    if (dlErr || !file) throw new Error(dlErr?.message ?? 'download failed');

    const buf = Buffer.from(await file.arrayBuffer());
    const { pages, totalPages } = await extractTextWithPages(buf);

    if (totalPages === 0 || pages.every((p) => !p.text)) {
      throw new Error('텍스트를 추출할 수 없는 PDF입니다 (이미지·스캔본 가능성).');
    }

    type ChunkRow = {
      source_id: string;
      page_number: number;
      chunk_index: number;
      content: string;
    };
    const rows: ChunkRow[] = [];
    let idx = 0;
    for (const p of pages) {
      const split = splitWithOverlap(p.text, { size: 800, overlap: 100 });
      for (const c of split) {
        rows.push({
          source_id: sourceId,
          page_number: p.page,
          chunk_index: idx++,
          content: c.text,
        });
      }
    }
    if (rows.length === 0) throw new Error('추출된 청크가 없습니다.');

    const embeddings = await embedTexts(rows.map((r) => r.content));
    const toInsert = rows.map((r, i) => ({
      ...r,
      embedding: embeddings[i] as unknown as string, // pgvector accepts JSON array
    }));

    // insert in slices of 200 to keep payloads sane
    const SLICE = 200;
    for (let i = 0; i < toInsert.length; i += SLICE) {
      const slice = toInsert.slice(i, i + SLICE);
      const { error: insErr } = await supabase.from('source_chunks').insert(slice);
      if (insErr) throw new Error(insErr.message);
    }

    await supabase
      .from('sources')
      .update({
        total_pages: totalPages,
        chunk_count: rows.length,
        indexing_status: 'ready',
        indexing_error: null,
        indexed_at: new Date().toISOString(),
      })
      .eq('id', sourceId);

    return { chunks: rows.length, totalPages };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from('sources')
      .update({ indexing_status: 'failed', indexing_error: msg })
      .eq('id', sourceId);
    throw e;
  }
}
