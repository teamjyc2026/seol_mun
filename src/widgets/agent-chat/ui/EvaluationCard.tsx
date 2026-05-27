'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { EvaluationResult } from '@/shared/agent/types';

export function EvaluationCard({ result }: { result: EvaluationResult }) {
  const pct = Math.round(result.score * 100);
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm',
        result.isCorrect
          ? 'border-emerald-200 bg-emerald-50/40'
          : 'border-rose-200 bg-rose-50/40',
      )}
    >
      <div
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-full text-white',
          result.isCorrect ? 'bg-emerald-500' : 'bg-rose-500',
        )}
      >
        {result.isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-zinc-900">
            {result.isCorrect ? '정답' : '오답'} · {pct}점
          </span>
          <span className="font-mono text-xs text-zinc-500">{result.studentId}</span>
        </div>
        <p className="text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">
          {result.feedback}
        </p>
      </div>
    </div>
  );
}
