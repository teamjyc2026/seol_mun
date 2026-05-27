import 'server-only';
import { GoogleGenAI } from '@google/genai';

export const GEMINI_GENERATION_MODEL = 'gemini-2.5-flash';
export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
// Matryoshka — gemini-embedding-001 supports configurable outputDimensionality.
// Our DB column is vector(768), so we request the matching size.
export const GEMINI_EMBEDDING_DIM = 768;

let cached: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (cached) return cached;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  cached = new GoogleGenAI({ apiKey });
  return cached;
}
