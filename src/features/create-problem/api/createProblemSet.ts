import { api } from '@/shared/api/axios';
import type { ProblemChoice, ProblemCitation, ProblemFigure } from '@/entities/problem';
import type { Subject } from '@/shared/config/subjects';

export type ProblemSetSubProblem = {
  topic?: string | null;
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  problem_type?: 'objective' | 'short' | 'long' | null;
  question: string;
  choices?: ProblemChoice[] | null;
  answer: string;
  explanation?: string | null;
  core_content?: string | null;
  choice_explanation?: string | null;
  figures?: ProblemFigure[];
  notes?: string | null;
  citations?: ProblemCitation[];
};

export type CreateProblemSetInput = {
  subject?: Subject;
  subjects?: Subject[];
  /** 공유 지문 (선택 — 지문 없이 문제만 묶는 세트도 가능). */
  passage?: string;
  shared?: {
    topic?: string | null;
    difficulty?: 'easy' | 'medium' | 'hard' | null;
    problem_type?: 'objective' | 'short' | 'long' | null;
    citations?: ProblemCitation[];
  };
  problems: ProblemSetSubProblem[];
};

export async function createProblemSet(
  input: CreateProblemSetInput,
): Promise<{ passageSetId: string; ids: string[] }> {
  const { data } = await api.put<{ passageSetId: string; ids: string[] }>(
    '/agent/problems',
    input,
  );
  return data;
}
