'use client';

import { SOLVE_STAGES } from '@/shared/agent/solveStage';
import { cn } from '@/shared/lib/cn';

/** 문제 풀이 코칭 진행 표시 — 문제 이해 → 조건 파악 → 전략 수립 → 풀이 실행 → 검토. */
export function SolveStepper({ stage }: { stage: number }) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      {SOLVE_STAGES.map((label, i) => {
        const n = i + 1;
        const current = n === stage;
        const done = n < stage;
        return (
          <div key={label} className="space-y-1.5">
            <div
              className={cn(
                'h-2.5 rounded-full transition-colors',
                current ? 'bg-orange-400' : done ? 'bg-orange-300' : 'bg-zinc-200',
              )}
            />
            <p
              className={cn(
                'text-center text-[11px] sm:text-xs',
                current ? 'font-extrabold text-zinc-900' : 'font-medium text-zinc-400',
              )}
            >
              {label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
