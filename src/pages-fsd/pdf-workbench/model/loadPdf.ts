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

/** 바이트(ArrayBuffer)에서 직접 로드 — 회전 직후 신선한 PDF를 CDN 우회로 받을 때. */
export async function loadPdfFromBytes(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  // pdfjs가 버퍼를 소유(detached)하므로 복사본을 넘긴다.
  return pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
}
