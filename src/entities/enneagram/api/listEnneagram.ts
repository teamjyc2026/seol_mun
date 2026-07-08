import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import type { EnneagramResponseRow } from '../model/types';

export async function listEnneagram(limit = 1000): Promise<EnneagramResponseRow[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('enneagram_responses')
    .select(
      'id, created_at, name, school, grade, phone, answers, scores, total, top_type, sub_type, user_agent',
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as EnneagramResponseRow[];
}
