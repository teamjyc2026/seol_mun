import { Fragment, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { parseRichText, type RichNode } from '@/shared/lib/richText';

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

/** "3" → "③"; an already-circled char or non-numeric value passes through. */
function circled(n: string): string {
  const i = Number.parseInt(n, 10);
  return Number.isFinite(i) && i >= 1 && i <= 10 ? CIRCLED[i - 1] : n;
}

function renderNodes(nodes: RichNode[]): ReactNode {
  return nodes.map((node, i) => <Fragment key={i}>{renderNode(node)}</Fragment>);
}

function renderNode(node: RichNode): ReactNode {
  if (typeof node === 'string') return node;
  const kids = renderNodes(node.children);
  switch (node.type) {
    case 'u':
      return (
        <u className="underline decoration-zinc-500 underline-offset-2">
          {node.attrs.n ? (
            <sup className="mr-0.5 text-[0.7em] text-zinc-500">{circled(node.attrs.n)}</sup>
          ) : null}
          {kids}
        </u>
      );
    case 'b':
      return <strong className="font-semibold">{kids}</strong>;
    case 'box':
      return (
        <span className="mx-0.5 inline-flex items-center rounded-[3px] border border-zinc-400 px-1 leading-snug">
          {kids}
        </span>
      );
    case 'num':
      return (
        <span className="mx-0.5 font-semibold text-zinc-900">
          {node.children.length === 0 && node.attrs.n ? circled(node.attrs.n) : kids}
        </span>
      );
    case 'blank':
      return (
        <span className="mx-0.5 inline-block min-w-[3.5rem] border-b border-zinc-500 text-center align-baseline">
          {kids}
        </span>
      );
    case 'p':
      return (
        <span className="mt-2 block first:mt-0">
          {node.attrs.label ? (
            <span className="mr-1.5 font-semibold text-zinc-900">({node.attrs.label})</span>
          ) : null}
          {kids}
        </span>
      );
    default:
      return kids;
  }
}

/**
 * Renders 지문/문항 markup (see docs/passage-markup.md) as safe React nodes.
 * Inline by default; block-level `<p>` paragraphs use display:block spans so
 * nesting stays valid in any context. Preserves authored line breaks.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('whitespace-pre-wrap', className)}>{renderNodes(parseRichText(text))}</span>
  );
}
