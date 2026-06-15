import type { BoxKind, BoxRect, WorkBox } from '../ui/PdfBoxViewer';
import type { WorkbenchProblemValue } from '../ui/WorkbenchProblemForm';

export type OcrProblem = {
  passage?: string;
  question: string;
  choices?: { label: string; text: string }[];
  answer?: string;
  explanation?: string;
  problem_type: 'objective' | 'short' | 'long';
  topic?: string;
};

export type ChunkValue = { category: string | null; topic: string; text: string };

/** 박스 ↔ 부속 PDF 답 영역 연결 (rect는 페이지 비율 0–1 정규화). */
export type AnswerRef = { attachmentId: string; page: number; rect: BoxRect };

export type BoxPayload = {
  problem?: WorkbenchProblemValue;
  chunk?: ChunkValue;
  answerRef?: AnswerRef;
};

export type BoxData = WorkBox & {
  problem: WorkbenchProblemValue;
  chunk: ChunkValue;
  answerRef: AnswerRef | null;
};

export type Attachment = { id: string; title: string; url: string };

/** 보조 뷰어 선택 — 같은 PDF 또는 부속 PDF 하나. */
export type RefSel = { type: 'same' } | { type: 'attachment'; id: string } | null;

export type PendingAttachment = { file: File; title: string };

export type JobSummary = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  attachmentCount: number;
  boxCount: number;
  savedCount: number;
  updated_at: string;
};

export type JobSource = {
  id: string;
  title: string;
  subject: string;
  grade: string | null;
};

export type JobDetail = {
  job: { id: string; title: string };
  source: JobSource;
  pdfUrl: string;
  attachments: Attachment[];
  boxes: {
    id: string;
    page: number;
    rect: BoxRect;
    kind: BoxKind;
    status: WorkBox['status'];
    payload: BoxPayload;
  }[];
};
