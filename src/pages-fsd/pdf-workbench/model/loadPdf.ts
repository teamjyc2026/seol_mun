import axios from 'axios';
import type { PDFDocumentProxy } from 'pdfjs-dist';

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  return pdfjs;
}

export async function loadPdfFromUrl(url: string): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  const { data } = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
  return pdfjs.getDocument({ data }).promise;
}
