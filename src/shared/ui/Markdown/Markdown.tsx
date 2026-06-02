'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

/**
 * Renders LLM chat markdown (bold/italic/lists/code/links) compactly.
 * Colors are inherited from the parent (so per-agent text color applies),
 * so no text-color classes are set here.
 */
const components: Components = {
  p: ({ children }) => <p className="mt-2 leading-relaxed first:mt-0">{children}</p>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="mt-2 list-disc space-y-1 pl-5 first:mt-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-2 list-decimal space-y-1 pl-5 first:mt-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children }) => (
    <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mt-2 overflow-x-auto rounded-lg bg-black/5 p-2 text-[0.85em] first:mt-0">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => <h3 className="mt-2 text-base font-bold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-2 text-base font-bold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h3 className="mt-2 text-sm font-bold first:mt-0">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-2 border-zinc-300 pl-3 opacity-90 first:mt-0">
      {children}
    </blockquote>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
