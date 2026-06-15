import type { BoxKind, BoxRect, WorkBox } from '../ui/PdfBoxViewer';
import type { WorkbenchProblemValue } from '../ui/WorkbenchProblemForm';

export type OcrProblem = {
  passage?: string;
  question: string;
  choices?: { label: string; text: string }[];
  answer?: string;
  explanation?: string;
  problem_type: 'objective' | 'short' | 'long';
  category?: string;
  topic?: string;
};

export type ChunkValue = { category: string | null; topic: string; text: string };

/** 박스 ↔ 부속 PDF 답 영역 연결 (rect는 페이지 비율 0–1 정규화). */
export type AnswerRef = { id: string; attachmentId: string; page: number; rect: BoxRect };

export type BoxPayload = {
  problem?: WorkbenchProblemValue;
  chunk?: ChunkValue;
  /** 여러 영역(다대일) 답 연결. */
  answerRefs?: AnswerRef[];
  /** 이 박스 인식에 쓴 누적 토큰 (분류+OCR+정답·해설). */
  tokens?: { in: number; out: number };
  /** @deprecated 레거시 단일 연결 — fromServerBox에서 배열로 정규화. */
  answerRef?: Omit<AnswerRef, 'id'> & { id?: string };
};

export type BoxData = WorkBox & {
  problem: WorkbenchProblemValue;
  chunk: ChunkValue;
  answerRefs: AnswerRef[];
  /** 이 박스에 쓴 누적 토큰. */
  tokensIn: number;
  tokensOut: number;
  /** 이 박스를 만든 사람(올린이) 닉네임 — 서버 created_by에서 해석. */
  actor: string | null;
  /** 저장된 문제/청크 id — 재저장 시 새로 만들지 않고 이 레코드를 갱신. */
  savedRef: string | null;
};

export type Attachment = { id: string; title: string; url: string; rotation: number };

/** 보조 뷰어 선택 — 같은 PDF 또는 부속 PDF 하나. */
export type RefSel = { type: 'same' } | { type: 'attachment'; id: string } | null;

export type PendingAttachment = { file: File; title: string };

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  jobCount: number;
};

export type JobSummary = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  folder_id: string | null;
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
  job: { id: string; title: string; rotation: number };
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
    saved_ref?: string | null;
    /** 올린이 닉네임 (created_by 해석). */
    actor?: string | null;
  }[];
};
