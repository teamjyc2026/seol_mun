import { api } from '@/shared/api/axios';
import type { SurveyAnswers } from '@/entities/survey';

export async function saveDraft(
  id: string,
  payload: { answers: SurveyAnswers },
): Promise<{ id: string }> {
  const { data } = await api.patch<{ id: string }>(`/responses/${id}`, payload);
  return data;
}
