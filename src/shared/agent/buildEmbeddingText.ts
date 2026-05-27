/**
 * Build the text that actually gets embedded for a chunk:
 * a metadata header followed by the chunk content.
 *
 * Two distinct chapter-like signals can appear in the header:
 *   단원:        — auto-derived per-chunk (from PDF outline / heuristic).
 *                  Precise to the page.
 *   책키워드:    — book-level keywords typed by the admin at upload time.
 *                  Always included for every chunk; useful when the
 *                  auto path is empty or for broader semantic matching.
 */
export type EmbedMeta = {
  subject?: string | null;
  grade?: string | null;
  publisher?: string | null;
  edition?: string | null;
  author?: string | null;
  source_type?: string | null;
  /** per-chunk chapter, derived from PDF outline / heuristic */
  chapterPath?: string[] | null;
  /** book-level keywords supplied by admin (fallback / supplementary) */
  bookKeywords?: string[] | null;
  tags?: string[] | null;
  title?: string | null;
  page?: number | null;
};

export function buildEmbeddingText(meta: EmbedMeta, content: string): string {
  const parts: string[] = [];
  if (meta.subject) parts.push(`과목:${meta.subject}`);
  if (meta.source_type) parts.push(`유형:${meta.source_type}`);
  if (meta.grade) parts.push(`학년:${meta.grade}`);
  if (meta.title) parts.push(`제목:${meta.title}`);
  if (meta.publisher) parts.push(`출판사:${meta.publisher}`);
  if (meta.edition) parts.push(`판본:${meta.edition}`);
  if (meta.author) parts.push(`저자:${meta.author}`);
  const chapter = (meta.chapterPath ?? []).filter(Boolean);
  if (chapter.length) parts.push(`단원:${chapter.join(' > ')}`);
  const bookKeywords = (meta.bookKeywords ?? []).filter(Boolean);
  if (bookKeywords.length) parts.push(`책키워드:${bookKeywords.join(',')}`);
  const tags = (meta.tags ?? []).filter(Boolean);
  if (tags.length) parts.push(`태그:${tags.join(',')}`);
  if (meta.page != null) parts.push(`페이지:${meta.page}`);
  const header = parts.length ? `[${parts.join(' / ')}]\n` : '';
  return header + content;
}
