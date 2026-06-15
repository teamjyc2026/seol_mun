export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const PROBLEM_TYPES = ['objective', 'short', 'long'] as const;
export type ProblemType = (typeof PROBLEM_TYPES)[number];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '쉬움',
  medium: '보통',
  hard: '어려움',
};

export const PROBLEM_TYPE_LABEL: Record<ProblemType, string> = {
  objective: '객관식',
  short: '단답',
  long: '서술',
};

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
  subjects?: string[];
  topic: string | null;
  difficulty: Difficulty | null;
  problem_type: ProblemType | null;
  /** shared passage / reading text when multiple problems share one source text */
  passage: string | null;
  /** 지문 해석 (한국어 번역/해석) — 해설과 별개 필드 */
  passage_translation?: string | null;
  /** uuid grouping problems that share the same passage */
  passage_set_id: string | null;
  question: string;
  choices: ProblemChoice[] | null;
  answer: string;
  explanation: string | null;
  citations: ProblemCitation[];
  notes: string | null;
  created_by: string | null;
  /** resolved nickname of the admin in created_by (uuid), attached at fetch time */
  author_nickname?: string | null;
  conversation_id: string | null;
  embedded_at: string | null;
};

export type ProblemDraft = Omit<Problem, 'id' | 'created_at'>;
