import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import type { ResponseRow } from '../model/types';

export async function listResponses(limit = 500): Promise<ResponseRow[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('responses')
    .select(
      'id, name, phone, affiliation, email, answers, gift, status, user_agent, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ResponseRow[];
}
