import { api } from '@/shared/api/axios';
import type { EnneagramInfo, EnneagramAnswers } from '@/entities/enneagram';

export type SubmitEnneagramPayload = {
  info: EnneagramInfo;
  answers: EnneagramAnswers;
};

/** 검사 결과는 관리자 페이지 전용 — 제출 응답에는 id만 내려온다. */
export type SubmitEnneagramResult = {
  id: string;
};

export async function submitEnneagram(
  payload: SubmitEnneagramPayload,
): Promise<SubmitEnneagramResult> {
  const { data } = await api.post<SubmitEnneagramResult>('/enneagram', payload);
  return data;
}
