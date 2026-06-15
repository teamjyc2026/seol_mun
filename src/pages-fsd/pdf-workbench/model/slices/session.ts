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

  openSession: (s: {
    jobId: string;
    jobTitle: string;
    source: JobSource;
    doc: PDFDocumentProxy;
    numPages: number;
  }) => void;
  closeSession: () => void;
  setPage: (n: number) => void;
  setOpening: (v: boolean) => void;
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

  openSession: ({ jobId, jobTitle, source, doc, numPages }) =>
    set({ jobId, jobTitle, source, doc, numPages, pageNum: 1 }),
  closeSession: () =>
    set({ jobId: null, jobTitle: '', source: null, doc: null, numPages: 0, pageNum: 1 }),
  setPage: (pageNum) => set({ pageNum }),
  setOpening: (opening) => set({ opening }),
});
