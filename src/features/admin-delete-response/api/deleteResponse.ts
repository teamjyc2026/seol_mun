import { api } from '@/shared/api/axios';

export async function deleteResponse(id: string): Promise<void> {
  await api.delete(`/admin/responses/${id}`);
}
