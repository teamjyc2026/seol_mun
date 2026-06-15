import type { StateCreator } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { JobSource, PageRotations } from '../types';
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
  /** 본 PDF 페이지별 회전(메타데이터, 즉시 렌더). 빈 키는 0°. */
  pageRotations: PageRotations;
  /** 이 작업 세션에서 Opus(OCR)가 쓴 누적 토큰. */
  tokensIn: number;
  tokensOut: number;
  /** 임베딩 대기(=embedding 비어있음) 개수 — 저장과 분리된 일괄 임베딩용. */
  embedPending: { problems: number; chunks: number };
  /** 일괄 임베딩 진행 중. */
  embedRunning: boolean;

  openSession: (s: {
    jobId: string;
    jobTitle: string;
    source: JobSource;
    doc: PDFDocumentProxy;
    numPages: number;
    pageRotations: PageRotations;
  }) => void;
  closeSession: () => void;
  setPage: (n: number) => void;
  setOpening: (v: boolean) => void;
  setPageRotations: (r: PageRotations) => void;
  addTokens: (input: number, output: number) => void;
  setEmbedPending: (p: { problems: number; chunks: number }) => void;
  setEmbedRunning: (v: boolean) => void;
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
  pageRotations: {},
  tokensIn: 0,
  tokensOut: 0,
  embedPending: { problems: 0, chunks: 0 },
  embedRunning: false,

  openSession: ({ jobId, jobTitle, source, doc, numPages, pageRotations }) =>
    set({
      jobId,
      jobTitle,
      source,
      doc,
      numPages,
      pageRotations,
      pageNum: 1,
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
      pageRotations: {},
      tokensIn: 0,
      tokensOut: 0,
    }),
  setPage: (pageNum) => set({ pageNum }),
  setOpening: (opening) => set({ opening }),
  setPageRotations: (pageRotations) => set({ pageRotations }),
  addTokens: (input, output) =>
    set((st) => ({ tokensIn: st.tokensIn + input, tokensOut: st.tokensOut + output })),
  setEmbedPending: (embedPending) => set({ embedPending }),
  setEmbedRunning: (embedRunning) => set({ embedRunning }),
});
