import { parseRichText, type RichNode } from './parseRichText';

/**
 * Plain-text projection of markup — drops all tags, keeps inner text.
 * Used for line-clamped table previews and embedding input (no tag noise).
 * `<p label="A">` becomes "(A) ...", empty `<blank/>` becomes a spaced blank.
 */
export function stripRichText(input: string): string {
  const walk = (nodes: RichNode[]): string =>
    nodes
      .map((n) => {
        if (typeof n === 'string') return n;
        if (n.type === 'blank' && n.children.length === 0) return ' ____ ';
        const inner = walk(n.children);
        if (n.type === 'p' && n.attrs.label) return `(${n.attrs.label}) ${inner}`;
        return inner;
      })
      .join('');
  return walk(parseRichText(input));
}
