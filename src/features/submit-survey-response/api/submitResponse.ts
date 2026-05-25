import { api } from '@/shared/api/axios';
import type { SurveySubmission } from '@/entities/survey';

export type SubmitResponseResult = { id: string };

export async function submitResponse(
  payload: SurveySubmission,
): Promise<SubmitResponseResult> {
  const { data } = await api.post<SubmitResponseResult>('/responses', payload);
  return data;
}
