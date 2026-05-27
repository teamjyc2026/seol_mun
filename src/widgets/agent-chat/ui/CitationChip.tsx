'use client';

import { FileText } from 'lucide-react';
import type { Citation } from '@/shared/agent/types';

export function CitationChip({
  citation,
  onClick,
}: {
  citation: Citation;
  onClick?: (c: Citation) => void;
}) {
  const chapter = (citation.chapterPath ?? []).filter(Boolean);
  return (
    <button
      type="button"
      onClick={() => onClick?.(citation)}
      title={citation.snippet}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-100"
    >
      <FileText className="h-3 w-3 shrink-0" />
      <span className="truncate">
        「{citation.sourceTitle ?? '소스'}」 p.{citation.page ?? '?'}
        {chapter.length > 0 ? (
          <span className="text-indigo-500"> · {chapter.join(' > ')}</span>
        ) : null}
      </span>
    </button>
  );
}
