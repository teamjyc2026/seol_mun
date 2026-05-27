import { api } from '@/shared/api/axios';

export async function reindexSource(id: string): Promise<void> {
  await api.post(`/agent/sources/${id}/reindex`, {});
}
