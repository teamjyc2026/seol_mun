import 'server-only';
import { getSupabaseServer } from './supabase-server';

export function getResponseCap(): number {
  const n = Number(process.env.SURVEY_RESPONSE_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100;
}

export async function getSubmittedCount(): Promise<number> {
  const supabase = getSupabaseServer();
  const { count, error } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'submitted');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function isClosed(): Promise<boolean> {
  return (await getSubmittedCount()) >= getResponseCap();
}
