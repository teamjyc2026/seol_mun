import { api } from '@/shared/api/axios';

export type ResponseSummary = {
  id: string;
  status: 'draft' | 'submitted';
  created_at: string;
};

export async function getResponseById(id: string): Promise<ResponseSummary> {
  const { data } = await api.get<ResponseSummary>(`/responses/${id}`);
  return data;
}
