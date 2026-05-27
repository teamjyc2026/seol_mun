import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import type { Source } from '../model/types';

export async function listSources(): Promise<Source[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('sources')
    .select(
      'id, created_at, title, source_type, subject, grade, publisher, year, description, file_path, original_filename, file_size_bytes, total_pages, chunk_count, indexing_status, indexing_error, indexed_at',
    )
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Source[];
}

export async function getSource(id: string): Promise<Source | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Source | null) ?? null;
}
