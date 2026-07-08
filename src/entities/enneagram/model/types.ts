/** 학생 기본 정보 (신입생 유입 이벤트용) */
export type EnneagramInfo = {
  name: string;
  school: string;
  grade: string;
  phone: string;
};

/** 영역(1~9) → 15문항 응답(1~5). 미응답은 0. */
export type EnneagramAnswers = Record<string, number[]>;

/** 영역(1~9) → 합산 점수(15~75) */
export type EnneagramScores = Record<string, number>;

/** computeScores 결과 */
export type EnneagramResult = {
  scores: EnneagramScores;
  total: number;
  /** 주요기질 (1~9) */
  top: number;
  /** 서브기질 (1~9) */
  sub: number;
};

/** DB(enneagram_responses) 한 행 */
export type EnneagramResponseRow = {
  id: string;
  created_at: string;
  name: string | null;
  school: string | null;
  grade: string | null;
  phone: string | null;
  answers: EnneagramAnswers;
  scores: EnneagramScores;
  total: number;
  top_type: number;
  sub_type: number;
  user_agent: string | null;
};
