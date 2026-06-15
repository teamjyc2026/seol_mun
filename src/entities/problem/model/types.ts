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

/** 문제에 딸린 그림/도표 — Storage에 올린 이미지 주소 + 캡션·해설. */
export type ProblemFigure = {
  /** public 스토리지 URL (problem-figures 버킷). */
  url: string;
  /** 그림 설명/캡션 (선택). */
  caption?: string;
  /** 이 그림에 대한 해설 (선택). */
  explanation?: string;
};

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
  /** 그림/도표 (이미지는 Storage URL, 도표는 본문 마크다운으로) */
  figures?: ProblemFigure[];
  citations: ProblemCitation[];
  notes: string | null;
  created_by: string | null;
  /** resolved nickname of the admin in created_by (uuid), attached at fetch time */
  author_nickname?: string | null;
  conversation_id: string | null;
  embedded_at: string | null;
};

export type ProblemDraft = Omit<Problem, 'id' | 'created_at'>;
