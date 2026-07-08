import { api } from '@/shared/api/axios';
import type {
  EnneagramInfo,
  EnneagramAnswers,
  EnneagramScores,
} from '@/entities/enneagram';

export type SubmitEnneagramPayload = {
  info: EnneagramInfo;
  answers: EnneagramAnswers;
};

export type SubmitEnneagramResult = {
  id: string;
  top: number;
  sub: number;
  scores: EnneagramScores;
  total: number;
};

export async function submitEnneagram(
  payload: SubmitEnneagramPayload,
): Promise<SubmitEnneagramResult> {
  const { data } = await api.post<SubmitEnneagramResult>('/enneagram', payload);
  return data;
}
