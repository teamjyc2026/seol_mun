import { api } from '@/shared/api/axios';
import type { ProblemCitation, ProblemChoice } from '@/entities/problem';

export type CreateProblemInput = {
  subject?: string;
  topic?: string | null;
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  problem_type?: 'objective' | 'short' | 'long' | null;
  passage?: string | null;
  passage_translation?: string | null;
  question: string;
  choices?: ProblemChoice[] | null;
  answer: string;
  explanation?: string | null;
  notes?: string | null;
  citations?: ProblemCitation[];
};

export async function createProblem(input: CreateProblemInput): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>('/agent/problems', input);
  return data;
}
