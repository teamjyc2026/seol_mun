import type { SourceChunk } from '@/entities/source/model/types';
import type { AgentId, Audience, ProblemPeek } from './agents/types';

export type Citation = {
  sourceId: string;
  sourceTitle?: string;
  page: number | null;
  snippet: string;
  /** auto-derived chapter breadcrumb for the cited chunk */
  chapterPath?: string[];
};

export type ProblemDraft = {
  id?: string;
  /** shared reading passage (markup-enabled) when the problem belongs to a passage set */
  passage?: string | null;
  /** uuid grouping problems that share one passage (지문 세트) */
  passage_set_id?: string | null;
  topic: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  problem_type: 'objective' | 'short' | 'long';
  question: string;
  choices: { label: string; text: string }[] | null;
  answer: string;
  explanation: string | null;
  /** 그림/도표 — Storage URL + 캡션·해설 */
  figures?: { url: string; caption?: string; explanation?: string }[] | null;
  citations: Citation[];
};

export type EvaluationResult = {
  problemId: string;
  isCorrect: boolean;
  score: number;
  feedback: string;
  studentId: string;
  attemptId: string;
};

export type LevelResult = {
  studentId: string;
  subject: string;
  levelOverall: number; // 0~100
  samples: number;
  byTopic: { topic: string; score: number; samples: number }[];
};

export type ToolResult =
  | { kind: 'search'; chunks: (SourceChunk & { similarity: number })[] }
  | { kind: 'generate_problem'; problems: ProblemDraft[] }
  | { kind: 'search_problem'; problems: ProblemDraft[] }
  | { kind: 'evaluate_answer'; result: EvaluationResult }
  | { kind: 'assess_level'; result: LevelResult };

export type AgentReply = {
  text: string;
  toolResults: ToolResult[];
  citations: Citation[];
  /** Which specialist produced this reply (undefined on older messages). */
  agent?: AgentId;
  /** 학생 모드 퀵리플라이 — 답변 끝에 붙는 선택지 버튼 (teacher에는 없음). */
  choices?: string[];
};

export type AgentContext = {
  conversationId: string;
  pinnedSourceIds: string[];
  studentId: string | null;
  subject: string;
  audience: Audience;
  /** Specialist peek constraints for search_problem (undefined = unconstrained). */
  problemPeek?: ProblemPeek;
  /** Set when the conversation is scoped to a school's RAG (학교별 RAG). */
  schoolName?: string | null;
  /** 시험범위가 문제를 한정할 때의 문제 id 화이트리스트 (없으면 전체 검색). */
  problemIds?: string[] | null;
};

export type StreamEvent =
  | { kind: 'meta'; conversationId: string; agent: AgentId; toolResults: ToolResult[]; citations: Citation[] }
  | { kind: 'token'; text: string }
  | { kind: 'error'; message: string }
  | { kind: 'done'; choices?: string[]; stage?: number | null };
