import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import type { SourceChunk } from '../model/types';

export async function getSourceChunks(
  sourceId: string,
  opts: { limit?: number } = {},
): Promise<SourceChunk[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('source_chunks')
    .select('id, source_id, page_number, chunk_index, content, chapter_path')
    .eq('source_id', sourceId)
    .order('chunk_index', { ascending: true })
    .limit(opts.limit ?? 500);
  if (error) throw new Error(error.message);
  return (data ?? []) as SourceChunk[];
}
