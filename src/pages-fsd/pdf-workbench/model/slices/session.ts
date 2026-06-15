import type { StateCreator } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { JobSource } from '../types';
import type { WorkbenchState } from '../store';

/** 열린 작업 세션 (메인 PDF·소스 메타·페이지 네비). */
export type SessionSlice = {
  jobId: string | null;
  jobTitle: string;
  source: JobSource | null;
  doc: PDFDocumentProxy | null;
  opening: boolean;
  pageNum: number;
  numPages: number;
  /** PDF 회전 (0/90/180/270) — 본 PDF는 파일에 굽기 때문에 보통 0. */
  rotation: number;
  /** 본 PDF를 회전해 원본 파일에 굽는 중 (다운로드→변환→재업로드). */
  rotating: boolean;
  /** 이 작업 세션에서 Opus(OCR)가 쓴 누적 토큰. */
  tokensIn: number;
  tokensOut: number;

  openSession: (s: {
    jobId: string;
    jobTitle: string;
    source: JobSource;
    doc: PDFDocumentProxy;
    numPages: number;
    rotation: number;
  }) => void;
  closeSession: () => void;
  setPage: (n: number) => void;
  setOpening: (v: boolean) => void;
  setRotation: (r: number) => void;
  setRotating: (v: boolean) => void;
  /** 회전 후 구운 PDF를 다시 로드해 교체. */
  setDoc: (doc: PDFDocumentProxy) => void;
  addTokens: (input: number, output: number) => void;
};

export const createSessionSlice: StateCreator<
  WorkbenchState,
  [],
  [],
  SessionSlice
> = (set) => ({
  jobId: null,
  jobTitle: '',
  source: null,
  doc: null,
  opening: false,
  pageNum: 1,
  numPages: 0,
  rotation: 0,
  rotating: false,
  tokensIn: 0,
  tokensOut: 0,

  openSession: ({ jobId, jobTitle, source, doc, numPages, rotation }) =>
    set({
      jobId,
      jobTitle,
      source,
      doc,
      numPages,
      rotation,
      pageNum: 1,
      rotating: false,
      tokensIn: 0,
      tokensOut: 0,
    }),
  closeSession: () =>
    set({
      jobId: null,
      jobTitle: '',
      source: null,
      doc: null,
      numPages: 0,
      pageNum: 1,
      rotation: 0,
      rotating: false,
      tokensIn: 0,
      tokensOut: 0,
    }),
  setPage: (pageNum) => set({ pageNum }),
  setOpening: (opening) => set({ opening }),
  setRotation: (rotation) => set({ rotation }),
  setRotating: (rotating) => set({ rotating }),
  setDoc: (doc) => set({ doc }),
  addTokens: (input, output) =>
    set((st) => ({ tokensIn: st.tokensIn + input, tokensOut: st.tokensOut + output })),
});
