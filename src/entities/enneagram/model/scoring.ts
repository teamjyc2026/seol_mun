import type { EnneagramAnswers, EnneagramResult, EnneagramScores } from './types';

/**
 * 영역별 응답을 합산해 점수·주요기질(top)·서브기질(sub)을 계산.
 * top = 최고점 유형, sub = 그 다음 유형. 동점이면 유형 번호가 작은 쪽 우선.
 */
export function computeScores(ans: EnneagramAnswers): EnneagramResult {
  const scores: EnneagramScores = {};
  let total = 0;
  for (let t = 1; t <= 9; t++) {
    const sum = (ans[t] ?? []).reduce((a, b) => a + (b || 0), 0);
    scores[t] = sum;
    total += sum;
  }
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(
    (a, b) => scores[b] - scores[a] || a - b,
  );
  return { scores, total, top: order[0], sub: order[1] };
}
