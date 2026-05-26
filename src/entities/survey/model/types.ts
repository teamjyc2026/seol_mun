export type PartId =
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4'
  | 'P5'
  | 'P6'
  | 'P7'
  | 'P8'
  | 'CONSENT';

export type QuestionType =
  | 'single'
  | 'select'
  | 'multi'
  | 'short'
  | 'long'
  | 'scale'
  | 'rank';

export type QuestionOption = { value: string; label: string };

export type ScaleConfig = {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
  allowEmpty?: boolean;
};

export type RankConfig = {
  /** how many ranks must be filled */
  max: number;
  /** if true, all options must be ranked (Q25) */
  allOptions: boolean;
};

export type QuestionId = `Q${string}`;

export type Question = {
  id: QuestionId;
  partId: PartId;
  type: QuestionType;
  title: string;
  helper?: string;
  options?: QuestionOption[];
  scale?: ScaleConfig;
  rank?: RankConfig;
  maxSelect?: number;
  placeholder?: string;
  optional?: boolean;
};

export type PartTheme = {
  /** tailwind class fragment for accent text */
  accentText: string;
  /** tailwind class fragment for accent bg */
  accentBg: string;
  /** tailwind class fragment for soft bg gradient */
  softGradient: string;
  /** tailwind ring color class */
  ring: string;
  /** label color for badge */
  badge: string;
};

export type Part = {
  id: PartId;
  index: number;
  title: string;
  subtitle?: string;
  description?: string;
  theme: PartTheme;
  questionIds: QuestionId[];
};

export type Survey = {
  id: string;
  title: string;
  parts: Part[];
  questions: Record<QuestionId, Question>;
};

/** Answer value types per question type. */
export type AnswerValue =
  | string
  | string[]
  | number
  | null
  | { [rank: string]: string };

export type SurveyAnswers = Record<QuestionId, AnswerValue>;

export type ConsentInfo = {
  privacy_agreed: boolean;
  name: string;
  phone: string;
  affiliation: string;
  email: string;
};

export type GiftChoice = 'oliveyoung' | 'cu';

export type SurveySubmission = {
  answers: SurveyAnswers;
  consent: ConsentInfo;
  gift: GiftChoice;
};
