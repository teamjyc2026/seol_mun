import type { ToolResult } from './types';

/**
 * 출제 턴에 클라이언트로 내려보내는 문제에서 정답·해설을 제거한다 (마스킹).
 * 원본은 agent_messages에 그대로 저장되어 다음 턴 채점에 쓰인다.
 */
export function maskProblemAnswers(results: ToolResult[]): ToolResult[] {
  return results.map((r) => {
    if (r.kind !== 'search_problem' && r.kind !== 'generate_problem') return r;
    return {
      ...r,
      problems: r.problems.map((p) => ({
        ...p,
        answer: '',
        explanation: null,
        // 그림은 보여주되 그림 해설은 정답 힌트가 될 수 있어 가린다.
        figures: p.figures?.map((f) => ({ url: f.url, caption: f.caption })),
      })),
    };
  });
}
