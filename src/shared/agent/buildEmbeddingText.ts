/**
 * Build the text that actually gets embedded for a chunk:
 * a metadata header followed by the chunk content.
 *
 * Including subject / grade / publisher / units in the embedding gives
 * the retriever a much better signal for queries like
 * "고1 임진왜란 객관식" where the keywords may not appear in body text.
 */
export type EmbedMeta = {
  subject?: string | null;
  grade?: string | null;
  publisher?: string | null;
  edition?: string | null;
  author?: string | null;
  source_type?: string | null;
  units?: string[] | null;
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
  const units = (meta.units ?? []).filter(Boolean);
  if (units.length) parts.push(`단원:${units.join(',')}`);
  const tags = (meta.tags ?? []).filter(Boolean);
  if (tags.length) parts.push(`태그:${tags.join(',')}`);
  if (meta.page != null) parts.push(`페이지:${meta.page}`);
  const header = parts.length ? `[${parts.join(' / ')}]\n` : '';
  return header + content;
}
