'use client';

import { TrendingUp } from 'lucide-react';
import type { LevelResult } from '@/shared/agent/types';

export function LevelCard({ result }: { result: LevelResult }) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-500 text-white">
          <TrendingUp className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-zinc-900">
              {result.studentId} · {result.subject}
            </span>
            <span className="font-mono text-xs text-zinc-500">
              샘플 {result.samples}건
            </span>
          </div>
          <p className="text-3xl font-bold tracking-tight text-indigo-700">
            {result.levelOverall}
            <span className="ml-1 text-base font-normal text-zinc-500">/ 100</span>
          </p>
        </div>
      </header>
      {result.byTopic.length > 0 ? (
        <ul className="space-y-1.5">
          {result.byTopic.map((t) => (
            <li key={t.topic} className="grid grid-cols-[1fr_auto] items-center gap-2">
              <div className="min-w-0">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs text-zinc-700">{t.topic}</span>
                  <span className="font-mono text-[11px] text-zinc-500">
                    {t.score} · n={t.samples}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${Math.min(100, t.score)}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
