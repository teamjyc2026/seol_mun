import type { SourceChunk } from '@/entities/source/model/types';
import type { AgentId, Audience } from './agents/types';

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
  topic: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  problem_type: 'objective' | 'short' | 'long';
  question: string;
  choices: { label: string; text: string }[] | null;
  answer: string;
  explanation: string | null;
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
};

export type AgentContext = {
  conversationId: string;
  pinnedSourceIds: string[];
  studentId: string | null;
  subject: string;
  audience: Audience;
};

export type StreamEvent =
  | { kind: 'meta'; conversationId: string; agent: AgentId; toolResults: ToolResult[]; citations: Citation[] }
  | { kind: 'token'; text: string }
  | { kind: 'error'; message: string }
  | { kind: 'done' };
