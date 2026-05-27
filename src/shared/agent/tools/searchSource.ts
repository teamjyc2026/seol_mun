import 'server-only';
import { z } from 'zod';
import { searchChunks } from '@/entities/source/api/searchChunks';
import type { AgentContext, ToolResult } from '../types';

export const searchSourceInput = z.object({
  query: z.string().min(1),
  k: z.number().int().min(1).max(20).optional(),
});

export async function searchSourceTool(
  raw: unknown,
  ctx: AgentContext,
): Promise<ToolResult> {
  const args = searchSourceInput.parse(raw);
  const chunks = await searchChunks(args.query, {
    k: args.k,
    sourceIds: ctx.pinnedSourceIds,
  });
  return {
    kind: 'search',
    chunks: chunks.map((c) => ({
      id: c.id,
      source_id: c.source_id,
      page_number: c.page_number,
      chunk_index: c.chunk_index,
      content: c.content,
      similarity: c.similarity,
    })),
  };
}
