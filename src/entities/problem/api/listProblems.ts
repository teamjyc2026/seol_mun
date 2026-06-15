import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { nicknamesByIds } from '@/shared/api/authors';
import type {
  Difficulty,
  Problem,
  ProblemType,
} from '../model/types';

export type ListProblemsFilters = {
  search?: string;
  topic?: string;
  difficulty?: Difficulty;
  problem_type?: ProblemType;
  sourceId?: string;
};

const COLUMNS =
  'id, created_at, subject, subjects, topic, difficulty, problem_type, passage, passage_set_id, question, choices, answer, explanation, figures, citations, notes, created_by, conversation_id, embedded_at';

async function attachAuthors(rows: Problem[]): Promise<Problem[]> {
  const map = await nicknamesByIds(rows.map((r) => r.created_by));
  return rows.map((r) => ({
    ...r,
    author_nickname: r.created_by ? (map.get(r.created_by) ?? null) : null,
  }));
}

export async function listProblems(
  filters: ListProblemsFilters = {},
): Promise<Problem[]> {
  const supabase = getSupabaseServer();
  let q = supabase
    .from('problems')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (filters.topic) q = q.ilike('topic', `%${filters.topic}%`);
  if (filters.difficulty) q = q.eq('difficulty', filters.difficulty);
  if (filters.problem_type) q = q.eq('problem_type', filters.problem_type);
  if (filters.search) {
    const term = filters.search.trim();
    if (term) {
      const like = `%${term}%`;
      q = q.or(`question.ilike.${like},answer.ilike.${like},explanation.ilike.${like}`);
    }
  }
  if (filters.sourceId) {
    // citations is jsonb array — filter rows whose array contains the source id
    q = q.contains('citations', [{ sourceId: filters.sourceId }]);
  }
  const { data, error } = await q.limit(500);
  if (error) throw new Error(error.message);
  return attachAuthors((data ?? []) as Problem[]);
}

export async function getProblem(id: string): Promise<Problem | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('problems')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [withAuthor] = await attachAuthors([data as Problem]);
  return withAuthor ?? null;
}
