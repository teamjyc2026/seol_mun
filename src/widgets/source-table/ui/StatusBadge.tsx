'use client';

import { cn } from '@/shared/lib/cn';
import type { IndexingStatus } from '@/entities/source';

const META: Record<IndexingStatus, { label: string; cls: string }> = {
  pending: { label: '대기', cls: 'border-zinc-200 bg-zinc-50 text-zinc-700' },
  processing: { label: '처리 중', cls: 'border-sky-200 bg-sky-50 text-sky-700' },
  ready: { label: '준비됨', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  failed: { label: '실패', cls: 'border-rose-200 bg-rose-50 text-rose-700' },
  needs_ocr: {
    label: 'OCR 필요',
    cls: 'border-amber-200 bg-amber-50 text-amber-700',
  },
};

export function StatusBadge({ status }: { status: IndexingStatus }) {
  const m = META[status] ?? META.pending;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}
