export type ChunkOptions = {
  /** target chunk size in characters */
  size?: number;
  /** overlap in characters */
  overlap?: number;
};

export type TextChunk = { text: string; charStart: number };

/**
 * Split a long text into overlapping chunks. Korean-friendly: prefers to
 * break on whitespace / punctuation near the boundary so we don't slice
 * inside a word or sentence.
 */
export function splitWithOverlap(
  input: string,
  { size = 800, overlap = 100 }: ChunkOptions = {},
): TextChunk[] {
  const text = (input ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  if (text.length <= size) return [{ text, charStart: 0 }];

  const out: TextChunk[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + size);
    let cut = end;
    if (end < text.length) {
      // backtrack to nearest sensible boundary
      const window = text.slice(i, end);
      const lastBreak = Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('? '),
        window.lastIndexOf('! '),
        window.lastIndexOf('。'),
        window.lastIndexOf('\n'),
        window.lastIndexOf(' '),
      );
      if (lastBreak > size * 0.5) cut = i + lastBreak + 1;
    }
    const piece = text.slice(i, cut).trim();
    if (piece) out.push({ text: piece, charStart: i });
    if (cut >= text.length) break;
    i = Math.max(cut - overlap, i + 1);
  }
  return out;
}
