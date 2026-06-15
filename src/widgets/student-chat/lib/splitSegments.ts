/**
 * 에이전트 답변을 빈 줄 기준으로 카톡 버블 단위로 쪼갠다.
 * 코드펜스 내부의 빈 줄, 목록 사이의 빈 줄(느슨한 목록)은 분할하지 않는다.
 */
export function splitSegments(text: string): string[] {
  const lines = text.split('\n');
  const segments: string[] = [];
  let buf: string[] = [];
  let inFence = false;
  const isList = (l: string) => /^\s*([-*+]\s|\d+[.)]\s)/.test(l);
  const flush = () => {
    const s = buf.join('\n').trim();
    if (s) segments.push(s);
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      buf.push(line);
      continue;
    }
    if (!inFence && line.trim() === '') {
      const prev = [...buf].reverse().find((l) => l.trim() !== '') ?? '';
      const next = lines.slice(i + 1).find((l) => l.trim() !== '') ?? '';
      if (isList(prev) && isList(next)) {
        buf.push(line);
        continue;
      }
      flush();
    } else {
      buf.push(line);
    }
  }
  flush();
  return segments;
}
