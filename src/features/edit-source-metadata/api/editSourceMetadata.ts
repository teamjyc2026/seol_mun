import { api } from '@/shared/api/axios';
import type { SourceMetadataPatch } from '@/entities/source';

export async function editSourceMetadata(
  id: string,
  patch: SourceMetadataPatch,
): Promise<void> {
  await api.patch(`/agent/sources/${id}/metadata`, patch);
}
