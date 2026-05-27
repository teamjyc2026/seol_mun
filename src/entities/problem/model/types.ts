export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const PROBLEM_TYPES = ['objective', 'short', 'long'] as const;
export type ProblemType = (typeof PROBLEM_TYPES)[number];

export type ProblemChoice = { label: string; text: string };

export type ProblemCitation = {
  sourceId: string;
  sourceTitle?: string;
  page: number | null;
  snippet: string;
};

export type Problem = {
  id: string;
  created_at: string;
  subject: string;
  topic: string | null;
  difficulty: Difficulty | null;
  problem_type: ProblemType | null;
  question: string;
  choices: ProblemChoice[] | null;
  answer: string;
  explanation: string | null;
  citations: ProblemCitation[];
  notes: string | null;
  created_by: string | null;
  conversation_id: string | null;
};

export type ProblemDraft = Omit<Problem, 'id' | 'created_at'>;
