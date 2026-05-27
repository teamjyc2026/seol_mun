import 'server-only';
import {
  GEMINI_EMBEDDING_DIM,
  GEMINI_EMBEDDING_MODEL,
  getGemini,
} from '@/shared/config/gemini';

/**
 * Embed a batch of texts using Gemini gemini-embedding-001 at 768d
 * (Matryoshka reduction).
 * Batches in groups of 100 (Gemini API limit).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = getGemini();
  const out: number[][] = [];
  const BATCH = 100;
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const res = await client.models.embedContent({
      model: GEMINI_EMBEDDING_MODEL,
      contents: slice,
      config: { outputDimensionality: GEMINI_EMBEDDING_DIM },
    });
    const embeddings = res.embeddings ?? [];
    for (const e of embeddings) {
      if (!e.values) throw new Error('Gemini returned empty embedding');
      out.push(e.values);
    }
  }
  if (out.length !== texts.length) {
    throw new Error(
      `embedTexts: expected ${texts.length} embeddings, got ${out.length}`,
    );
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}
