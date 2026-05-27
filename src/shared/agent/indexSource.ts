import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { embedTexts } from '@/shared/lib/embedding';
import {
  chapterPathForPage,
  detectChaptersByHeuristic,
  extractTextWithPages,
} from '@/shared/lib/pdf';
import { splitWithOverlap } from '@/shared/lib/chunk';
import { buildEmbeddingText, type EmbedMeta } from './buildEmbeddingText';

// Scanned/image PDFs typically extract 0–10 chars per page (just metadata).
// Real text PDFs usually go well above 200 chars/page. We err generous to
// avoid false positives on short summaries.
const OCR_DENSITY_THRESHOLD = 20;
const OCR_TOTAL_CHARS_MIN = 40;

export async function indexSource(sourceId: string): Promise<{
  chunks: number;
  totalPages: number;
  needsOcr: boolean;
  textDensity: number;
  outlineEntries: number;
}> {
  const supabase = getSupabaseServer();

  await supabase
    .from('sources')
    .update({ indexing_status: 'processing', indexing_error: null })
    .eq('id', sourceId);

  const { data: source, error: srcErr } = await supabase
    .from('sources')
    .select(
      'id, file_path, title, subject, grade, publisher, edition, author, source_type, units, tags',
    )
    .eq('id', sourceId)
    .single();
  if (srcErr || !source) throw new Error(srcErr?.message ?? 'source not found');

  try {
    const { data: file, error: dlErr } = await supabase.storage
      .from('sources')
      .download(source.file_path);
    if (dlErr || !file) throw new Error(dlErr?.message ?? 'download failed');

    const buf = Buffer.from(await file.arrayBuffer());
    const { pages, totalPages, outline } = await extractTextWithPages(buf);

    const totalChars = pages.reduce((sum, p) => sum + (p.text?.length ?? 0), 0);
    const textDensity = totalChars / Math.max(1, totalPages);

    if (
      totalPages === 0 ||
      totalChars < OCR_TOTAL_CHARS_MIN ||
      textDensity < OCR_DENSITY_THRESHOLD
    ) {
      const msg = `텍스트 추출량이 너무 적습니다 (페이지당 평균 ${textDensity.toFixed(
        1,
      )}자, 총 ${totalChars}자). 스캔본/이미지 PDF로 추정 — OCR된 PDF로 재업로드해 주세요.`;
      await supabase
        .from('sources')
        .update({
          total_pages: totalPages,
          chunk_count: 0,
          text_density: textDensity,
          needs_ocr: true,
          indexing_status: 'needs_ocr',
          indexing_error: msg,
          indexed_at: null,
        })
        .eq('id', sourceId);
      return {
        chunks: 0,
        totalPages,
        needsOcr: true,
        textDensity,
        outlineEntries: 0,
      };
    }

    const heuristic = outline.length === 0 ? detectChaptersByHeuristic(pages) : new Map();

    const sharedMeta: EmbedMeta = {
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

    type ChunkRow = {
      source_id: string;
      page_number: number;
      chunk_index: number;
      content: string;
      chapter_path: string[];
    };
    const rows: ChunkRow[] = [];
    const embedInputs: string[] = [];
    let idx = 0;
    for (const p of pages) {
      const chapterPath = chapterPathForPage(p.page, outline, heuristic);
      const split = splitWithOverlap(p.text, { size: 800, overlap: 100 });
      for (const c of split) {
        rows.push({
          source_id: sourceId,
          page_number: p.page,
          chunk_index: idx++,
          content: c.text,
          chapter_path: chapterPath,
        });
        embedInputs.push(
          buildEmbeddingText(
            { ...sharedMeta, page: p.page, chapterPath },
            c.text,
          ),
        );
      }
    }
    if (rows.length === 0) throw new Error('추출된 청크가 없습니다.');

    const embeddings = await embedTexts(embedInputs);
    const toInsert = rows.map((r, i) => ({
      ...r,
      embedding: embeddings[i] as unknown as string,
    }));

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
        text_density: textDensity,
        needs_ocr: false,
        indexing_status: 'ready',
        indexing_error: null,
        indexed_at: new Date().toISOString(),
      })
      .eq('id', sourceId);

    return {
      chunks: rows.length,
      totalPages,
      needsOcr: false,
      textDensity,
      outlineEntries: outline.length,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from('sources')
      .update({ indexing_status: 'failed', indexing_error: msg })
      .eq('id', sourceId);
    throw e;
  }
}
