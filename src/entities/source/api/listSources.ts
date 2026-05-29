import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import type { IndexingStatus, Source, SourceType } from '../model/types';

export type ListSourcesFilters = {
  search?: string;
  subject?: string;
  source_type?: SourceType;
  status?: IndexingStatus;
  grade?: string;
};

const COLUMNS =
  'id, created_at, title, source_type, subject, subjects, grade, publisher, year, description, author, edition, isbn, language, units, tags, file_path, original_filename, file_size_bytes, total_pages, chunk_count, text_density, needs_ocr, indexing_status, indexing_error, indexed_at';

export async function listSources(
  filters: ListSourcesFilters = {},
): Promise<Source[]> {
  const supabase = getSupabaseServer();
  let q = supabase
    .from('sources')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (filters.subject) {
    // match either legacy single subject or new array
    q = q.or(`subject.eq.${filters.subject},subjects.cs.{${filters.subject}}`);
  }
  if (filters.source_type) q = q.eq('source_type', filters.source_type);
  if (filters.status) q = q.eq('indexing_status', filters.status);
  if (filters.grade) q = q.eq('grade', filters.grade);
  if (filters.search) {
    const term = filters.search.trim();
    if (term) {
      const like = `%${term}%`;
      q = q.or(
        `title.ilike.${like},publisher.ilike.${like},author.ilike.${like},description.ilike.${like}`,
      );
    }
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Source[];
}

export async function getSource(id: string): Promise<Source | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('sources')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Source | null) ?? null;
}
