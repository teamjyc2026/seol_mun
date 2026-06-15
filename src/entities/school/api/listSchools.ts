import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import type { School } from '../model/types';

export async function listSchools(): Promise<School[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, description, grade, year, created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as School[];
}
