import { api } from '@/shared/api/axios';

export async function deleteSource(id: string): Promise<void> {
  await api.delete(`/agent/sources/${id}`);
}
