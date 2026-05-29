import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { embedQuery } from '@/shared/lib/embedding';
import type { SourceChunk } from '../model/types';

export type SearchChunkRow = SourceChunk & { similarity: number };

export async function searchChunks(
  query: string,
  opts: { k?: number; sourceIds?: string[]; subject?: string } = {},
): Promise<SearchChunkRow[]> {
  const embedding = await embedQuery(query);
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc('match_source_chunks', {
    query_embedding: embedding as unknown as number[],
    match_count: opts.k ?? 8,
    filter_source_ids:
      opts.sourceIds && opts.sourceIds.length > 0 ? opts.sourceIds : null,
    filter_subject: opts.subject ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as SearchChunkRow[];
}
