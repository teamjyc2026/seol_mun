/**
 * 문제 풀이 코칭 5단계 — 에이전트가 답변에 `{{단계:N}}` 마커를 출력하면
 * 서버/클라이언트가 분리해 스테퍼 UI에 반영한다. quickReplies와 같은
 * isomorphic 유틸.
 */

export const SOLVE_STAGES = [
  '문제 이해',
  '조건 파악',
  '전략 수립',
  '풀이 실행',
  '검토',
] as const;

const STAGE_RE = /\{\{\s*단계\s*[:：]\s*([^}]+?)\s*\}\}/;
const STAGE_RE_GLOBAL = /[ \t]*\{\{\s*단계\s*[:：]\s*[^}]*?\}\}[ \t]*\n?/g;

function toStageNumber(v: string): number | null {
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= SOLVE_STAGES.length) return n;
  const idx = SOLVE_STAGES.findIndex((s) => v.includes(s));
  return idx >= 0 ? idx + 1 : null;
}

/** 완성된 텍스트에서 단계 마커를 추출·제거 (저장 전 / 리로드 안전망). */
export function parseSolveStage(text: string): { text: string; stage: number | null } {
  const m = text.match(STAGE_RE);
  const stage = m ? toStageNumber(m[1]) : null;
  return { text: text.replace(STAGE_RE_GLOBAL, '').trim(), stage };
}

/**
 * 스트리밍 표시용: 완성된 마커는 제거하고, 꼬리에 만들어지는 중인
 * 마커(`{{단계:`가 아직 안 닫힘)는 그 줄을 보류한다.
 */
export function stripStageMarkers(raw: string): string {
  const out = raw.replace(STAGE_RE_GLOBAL, '');
  const nl = out.lastIndexOf('\n');
  const lastLine = out.slice(nl + 1);
  if (/\{\{[^}]*$/.test(lastLine)) return out.slice(0, Math.max(nl, 0));
  return out;
}
