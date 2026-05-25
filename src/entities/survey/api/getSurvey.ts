import { parts } from '../model/parts';
import { questions } from '../model/questions';
import type { Survey } from '../model/types';

const survey: Survey = {
  id: 'seolmun-v1',
  title: 'AI 학습 튜터 서비스 사전 설문',
  parts,
  questions,
};

/**
 * GET handler (entities layer). Currently returns local data wrapped in a
 * Promise; switch to `api.get('/survey')` later without touching callers.
 */
export async function getSurvey(): Promise<Survey> {
  return Promise.resolve(survey);
}
