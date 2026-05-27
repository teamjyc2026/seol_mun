import { api } from '@/shared/api/axios';

export async function deleteProblem(id: string): Promise<void> {
  await api.delete(`/agent/problems/${id}`);
}
