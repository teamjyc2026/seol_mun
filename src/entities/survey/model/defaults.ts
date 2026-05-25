import { questionList } from './questions';
import type { SurveyAnswers } from './types';

export function buildDefaultAnswers(): SurveyAnswers {
  const out: SurveyAnswers = {} as SurveyAnswers;
  for (const q of questionList) {
    switch (q.type) {
      case 'single':
      case 'short':
      case 'long':
        out[q.id] = '';
        break;
      case 'multi':
        out[q.id] = [];
        break;
      case 'scale':
        out[q.id] = q.scale?.allowEmpty || q.optional ? null : (null as never);
        break;
      case 'rank':
        out[q.id] = {};
        break;
    }
  }
  return out;
}
