/**
 * Lightweight HTML-like markup parser for 수능 지문 특수서식.
 *
 * Recognizes ONLY a small whitelist of tags. Any '<' that is not the start of
 * a recognized tag is kept as literal text — so plain content like "a < b"
 * never breaks, and there is no arbitrary-HTML injection surface (the renderer
 * never uses dangerouslySetInnerHTML).
 *
 * Tags may nest (`<box><u>x</u></box>`). Mismatched / unclosed tags fall back
 * to their literal source text rather than throwing.
 *
 * See docs/passage-markup.md for the full tag spec.
 */

export const RICH_TAGS = ['u', 'box', 'num', 'p', 'blank', 'b'] as const;
export type RichTag = (typeof RICH_TAGS)[number];

export type RichAttrs = { n?: string; label?: string };
export type RichElement = { type: RichTag; attrs: RichAttrs; children: RichNode[] };
export type RichNode = string | RichElement;

const WHITELIST = new Set<string>(RICH_TAGS);

// <tag attr="v">, </tag>, <tag/> — attrs only double/single-quoted.
const TAG_RE = /^<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/;
const ATTR_RE = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function parseAttrs(raw: string): RichAttrs {
  const attrs: RichAttrs = {};
  if (!raw) return attrs;
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(raw))) {
    const key = m[1].toLowerCase();
    const val = m[2] ?? m[3] ?? '';
    if (key === 'n') attrs.n = val;
    else if (key === 'label') attrs.label = val;
  }
  return attrs;
}

type Frame = { type: RichTag | 'root'; attrs: RichAttrs; children: RichNode[]; raw: string };

export function parseRichText(input: string): RichNode[] {
  const root: Frame = { type: 'root', attrs: {}, children: [], raw: '' };
  const stack: Frame[] = [root];
  const top = () => stack[stack.length - 1];

  let buf = '';
  const flush = () => {
    if (buf) {
      top().children.push(buf);
      buf = '';
    }
  };

  // Replace an orphaned (never-closed) open tag with its literal source text.
  const unwrap = (frame: Frame) => {
    const parent = top();
    parent.children.pop(); // remove the orphan element added at open time
    parent.children.push(frame.raw, ...frame.children);
  };

  let i = 0;
  while (i < input.length) {
    if (input[i] === '<') {
      const m = TAG_RE.exec(input.slice(i));
      if (m && WHITELIST.has(m[2].toLowerCase())) {
        const closing = m[1] === '/';
        const selfClose = m[4] === '/';
        const tag = m[2].toLowerCase() as RichTag;
        const raw = m[0];

        if (closing) {
          let idx = -1;
          for (let s = stack.length - 1; s >= 1; s--) {
            if (stack[s].type === tag) {
              idx = s;
              break;
            }
          }
          if (idx === -1) {
            buf += raw; // stray close tag → literal
          } else {
            flush();
            while (stack.length - 1 > idx) unwrap(stack.pop()!);
            stack.pop(); // close the matched element
          }
        } else if (selfClose) {
          flush();
          top().children.push({ type: tag, attrs: parseAttrs(m[3]), children: [] });
        } else {
          flush();
          const el: RichElement = { type: tag, attrs: parseAttrs(m[3]), children: [] };
          top().children.push(el);
          stack.push({ ...el, raw });
        }
        i += raw.length;
        continue;
      }
      buf += '<';
      i += 1;
      continue;
    }
    buf += input[i];
    i += 1;
  }

  flush();
  while (stack.length > 1) unwrap(stack.pop()!);
  return root.children;
}
