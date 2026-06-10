import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { embedTexts } from '@/shared/lib/embedding';
import {
  chapterPathForPage,
  detectChaptersByHeuristic,
  extractTextWithPages,
} from '@/shared/lib/pdf';
import { splitWithOverlap } from '@/shared/lib/chunk';
import { OCR_MAX_PAGES, ocrPdfWithClaude } from '@/shared/lib/ocr';
import { buildEmbeddingText, type EmbedMeta } from './buildEmbeddingText';

// Scanned/image PDFs typically extract 0–10 chars per page (just metadata).
// Real text PDFs usually go well above 200 chars/page. We err generous to
// avoid false positives on short summaries.
const OCR_DENSITY_THRESHOLD = 20;
const OCR_TOTAL_CHARS_MIN = 40;

/**
 * Strip characters that Postgres/JSON reject from extracted PDF text:
 * NUL + other C0/C1 control chars (keep tab/newline/CR) and unpaired
 * surrogate halves. Without this, chunk inserts fail with "unsupported
 * Unicode escape sequence" (SQLSTATE 22P05) and the source is marked failed.
 */
function sanitizeText(s: string): string {
  if (!s) return s;
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c === 0x09 || c === 0x0a || c === 0x0d) {
      out += ch;
      continue;
    }
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f)) continue; // NUL + C0/C1 controls
    if (c >= 0xd800 && c <= 0xdfff) continue; // lone surrogate half
    out += ch;
  }
  return out;
}

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
    const extracted = await extractTextWithPages(buf);
    const { totalPages, outline } = extracted;
    let pages = extracted.pages;

    let totalChars = pages.reduce((sum, p) => sum + (p.text?.length ?? 0), 0);
    let textDensity = totalChars / Math.max(1, totalPages);
    let usedOcr = false;

    if (
      totalPages === 0 ||
      totalChars < OCR_TOTAL_CHARS_MIN ||
      textDensity < OCR_DENSITY_THRESHOLD
    ) {
      // Scanned/image PDF — fall back to Claude OCR instead of bailing out.
      if (totalPages > 0 && totalPages <= OCR_MAX_PAGES) {
        pages = await ocrPdfWithClaude(buf);
        totalChars = pages.reduce((sum, p) => sum + (p.text?.length ?? 0), 0);
        textDensity = totalChars / Math.max(1, totalPages);
        usedOcr = true;
      }
      if (totalChars < OCR_TOTAL_CHARS_MIN) {
        const msg = usedOcr
          ? `Claude OCR 후에도 텍스트가 거의 없습니다 (총 ${totalChars}자). 빈 PDF이거나 판독 불가.`
          : `텍스트 추출량이 너무 적고 페이지 수(${totalPages})가 OCR 한도(${OCR_MAX_PAGES})를 넘습니다. PDF를 분할해 재업로드해 주세요.`;
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
      const chapterPath = chapterPathForPage(p.page, outline, heuristic).map(sanitizeText);
      const split = splitWithOverlap(sanitizeText(p.text), { size: 800, overlap: 100 });
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
        // usedOcr=true means "scanned PDF, indexed via Claude OCR" — status is
        // ready either way.
        needs_ocr: usedOcr,
        indexing_status: 'ready',
        indexing_error: null,
        indexed_at: new Date().toISOString(),
      })
      .eq('id', sourceId);

    return {
      chunks: rows.length,
      totalPages,
      needsOcr: usedOcr,
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
