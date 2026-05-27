import 'server-only';

export type PdfPage = { page: number; text: string };

/**
 * Extract per-page text from a PDF buffer.
 *
 * Uses `unpdf` (serverless-friendly pdfjs wrapper) so we don't have to
 * ship a separate pdf.worker file in the Next.js server bundle.
 */
export async function extractTextWithPages(buf: Buffer): Promise<{
  pages: PdfPage[];
  totalPages: number;
}> {
  const { getDocumentProxy, extractText } = await import('unpdf');
  const u8 = new Uint8Array(buf);
  const pdf = await getDocumentProxy(u8);
  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  const pieces: string[] = Array.isArray(text) ? text : [text];
  const pages: PdfPage[] = pieces.map((t, i) => ({
    page: i + 1,
    text: (t ?? '').trim(),
  }));
  return { pages, totalPages };
}
