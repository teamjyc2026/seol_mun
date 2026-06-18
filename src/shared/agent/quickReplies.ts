/**
 * 학생 모드 퀵리플라이 — 에이전트 답변의 마지막 줄 `[[선택지1 | 선택지2]]`를
 * 파싱·제거한다. 서버(저장 전)와 클라이언트(스트리밍 표시) 양쪽에서 쓰는
 * isomorphic 유틸이라 server-only를 import하지 않는다.
 */

type Parsed = { text: string; choices: string[] };

const TRAILER_RE = /\n?[ \t]*\[\[([^[\]\n]+)\]\][ \t]*$/;

/** "A | B | C" 또는 "A / B / C"를 선택지 배열로. */
function splitChoices(inner: string): string[] {
  return inner
    .split(/\s*[|/]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
}

/**
 * 완성된 텍스트에서 선택지 트레일러를 분리 (저장 전 / 리로드 안전망).
 * 1순위: 마지막 줄 `[[A | B | C]]`. 2순위(모델이 괄호를 빼먹은 폴백):
 * 마지막 줄이 " / "로 2~4등분된 짧은 선택지 줄이면 버튼으로 인식.
 */
export function parseQuickReplies(text: string): Parsed {
  const m = text.match(TRAILER_RE);
  if (m) {
    return { text: text.slice(0, m.index).trim(), choices: splitChoices(m[1]) };
  }
  const nl = text.lastIndexOf('\n');
  const lastLine = text.slice(nl + 1).trim();
  if (lastLine && lastLine.length <= 90 && /\s\/\s/.test(lastLine)) {
    const parts = splitChoices(lastLine);
    if (parts.length >= 2 && parts.length <= 4 && parts.every((p) => p.length >= 1 && p.length <= 30)) {
      return { text: text.slice(0, Math.max(nl, 0)).trim(), choices: parts };
    }
  }
  return { text: text.trim(), choices: [] };
}

/**
 * 스트리밍 표시용: 꼬리에 만들어지는 중인 트레일러를 숨긴다.
 * `[[`가 토큰 경계에서 `[` + `[`로 쪼개져 와도 마지막 줄이 `[`로 시작하면
 * 그 줄 전체를 보류한다.
 */
export function stripTrailerTail(raw: string): string {
  const full = raw.match(TRAILER_RE);
  if (full) return raw.slice(0, full.index);
  const nl = raw.lastIndexOf('\n');
  const lastLine = raw.slice(nl + 1);
  if (/^[ \t]*\[/.test(lastLine)) return raw.slice(0, Math.max(nl, 0));
  return raw;
}

/** 빈 대화 시작 화면의 스타터 버튼. */
export const DEFAULT_QUICK_REPLIES = [
  '문제 풀어보기 🔥',
  '단어 퀴즈 📚',
  '본문 암기 체크 🧠',
  '그냥 수다 떨기 💬',
];
