import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { embedQuery } from '@/shared/lib/embedding';
import type { ProblemChoice, ProblemCitation } from '../model/types';

export type ProblemMatch = {
  id: string;
  subject: string;
  subjects: string[] | null;
  topic: string | null;
  difficulty: string | null;
  problem_type: string | null;
  question: string;
  choices: ProblemChoice[] | null;
  answer: string;
  explanation: string | null;
  citations: ProblemCitation[] | null;
  similarity: number;
};

/** Vector search over embedded problems (problems.embedding), optionally by subject. */
export async function searchProblems(
  query: string,
  opts: { k?: number; subject?: string } = {},
): Promise<ProblemMatch[]> {
  const embedding = await embedQuery(query);
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc('match_problems', {
    query_embedding: embedding as unknown as number[],
    match_count: opts.k ?? 5,
    filter_subject: opts.subject ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProblemMatch[];
}
