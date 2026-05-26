'use client';

import { useMemo } from 'react';
import {
  buildAggregations,
  parts,
  questions,
  type QuestionAggregation,
} from '@/entities/survey';
import type { ResponseRow as Row } from '@/entities/response';
import { cn } from '@/shared/lib/cn';

export function QuestionSummary({ responses }: { responses: Row[] }) {
  const agg = useMemo(
    () =>
      buildAggregations(
        responses.map((r) => ({
          answers: (r.answers ?? {}) as Parameters<
            typeof buildAggregations
          >[0][number]['answers'],
        })),
      ),
    [responses],
  );

  return (
    <div className="space-y-8">
      {parts
        .filter((p) => p.id !== 'CONSENT')
        .map((part) => (
          <section key={part.id}>
            <h2 className={cn('mb-3 text-sm font-bold', part.theme.accentText)}>
              {part.title}
            </h2>
            <div className="space-y-3">
              {part.questionIds.map((qid) => {
                const q = questions[qid];
                const a = agg[qid];
                if (!q || !a) return null;
                return (
                  <article
                    key={qid}
                    className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                  >
                    <header className="mb-3 flex items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-zinc-400">{qid}</p>
                        <h3 className="truncate text-sm font-semibold text-zinc-900">
                          {q.title}
                        </h3>
                      </div>
                      <span className="shrink-0 text-xs text-zinc-500">
                        응답 {a.total}
                      </span>
                    </header>
                    <Body agg={a} accent={part.theme.accentBg} />
                  </article>
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );
}

function Body({
  agg,
  accent,
}: {
  agg: QuestionAggregation;
  accent: string;
}) {
  if (agg.total === 0) {
    return <p className="text-xs text-zinc-400">집계할 응답이 없어요.</p>;
  }
  switch (agg.kind) {
    case 'single':
    case 'multi':
      return <BarList counts={agg.counts} accent={accent} />;
    case 'scale':
      return <ScaleDist agg={agg} accent={accent} />;
    case 'rank':
      return <RankTable agg={agg} accent={accent} />;
    case 'text':
      return <TextSamples agg={agg} />;
  }
}

function BarList({
  counts,
  accent,
}: {
  counts: { label: string; count: number; percent: number }[];
  accent: string;
}) {
  const max = Math.max(0.0001, ...counts.map((c) => c.percent));
  return (
    <ul className="space-y-1.5">
      {counts.map((c) => {
        const widthPct = (c.percent / max) * 100;
        return (
          <li key={c.label} className="grid grid-cols-[1fr_auto] items-center gap-2">
            <div className="min-w-0">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-xs text-zinc-700">{c.label}</span>
                <span className="shrink-0 font-mono text-[11px] text-zinc-500">
                  {c.count} · {(c.percent * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={cn('h-full rounded-full transition-all', accent)}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ScaleDist({
  agg,
  accent,
}: {
  agg: Extract<QuestionAggregation, { kind: 'scale' }>;
  accent: string;
}) {
  const max = Math.max(1, ...agg.dist);
  return (
    <div>
      <p className="mb-3 text-sm">
        <span className="text-zinc-500">평균</span>{' '}
        <span className="font-mono font-semibold text-zinc-900">
          {agg.avg.toFixed(2)}
        </span>
        <span className="text-zinc-400"> / {agg.max}</span>
      </p>
      <div className="flex h-32 items-end gap-2">
        {agg.dist.map((count, i) => {
          const score = agg.min + i;
          const h = (count / max) * 100;
          return (
            <div key={score} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] font-mono text-zinc-500">{count}</span>
              <div
                className={cn(
                  'w-full rounded-t-md transition-all',
                  accent,
                  count === 0 && 'bg-zinc-100',
                )}
                style={{ height: `${Math.max(2, h)}%` }}
              />
              <span className="text-xs font-medium text-zinc-700">{score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RankTable({
  agg,
  accent,
}: {
  agg: Extract<QuestionAggregation, { kind: 'rank' }>;
  accent: string;
}) {
  return (
    <ol className="space-y-1.5">
      {agg.rows.map((row, i) => (
        <li
          key={row.value}
          className="grid grid-cols-[28px_1fr_auto] items-center gap-3 text-sm"
        >
          <span
            className={cn(
              'grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white',
              Number.isFinite(row.avgRank) ? accent : 'bg-zinc-300',
            )}
          >
            {i + 1}
          </span>
          <span className="truncate text-zinc-800">{row.label}</span>
          <span className="shrink-0 font-mono text-xs text-zinc-500">
            {Number.isFinite(row.avgRank) ? `평균 ${row.avgRank.toFixed(2)}` : '—'}
            <span className="ml-2 text-zinc-400">({row.count})</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function TextSamples({
  agg,
}: {
  agg: Extract<QuestionAggregation, { kind: 'text' }>;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">총 {agg.total}건</p>
      <ul className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50/60 p-2">
        {agg.samples.slice(0, 50).map((s, i) => (
          <li
            key={i}
            className="rounded-md bg-white px-2.5 py-1.5 text-xs text-zinc-700 shadow-xs"
          >
            {s}
          </li>
        ))}
        {agg.samples.length > 50 ? (
          <li className="px-2.5 py-1 text-[11px] text-zinc-400">
            … 외 {agg.samples.length - 50}건
          </li>
        ) : null}
      </ul>
    </div>
  );
}
