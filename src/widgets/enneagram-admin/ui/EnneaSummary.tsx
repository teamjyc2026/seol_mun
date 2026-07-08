'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import {
  AREA,
  QUESTIONS,
  SCALE,
  TYPES,
  areaQuestionAgg,
  averageScores,
  typeDistribution,
  type EnneagramResponseRow as Row,
  type TypeDistItem,
} from '@/entities/enneagram';

const TYPE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const MAX_SCORE = 75;

export function EnneaSummary({ rows }: { rows: Row[] }) {
  const topDist = useMemo(() => typeDistribution(rows, 'top_type'), [rows]);
  const subDist = useMemo(() => typeDistribution(rows, 'sub_type'), [rows]);
  const avg = useMemo(() => averageScores(rows), [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-500">
        집계할 결과가 없어요.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card title="주요기질 분포">
        <DistBars items={topDist} />
      </Card>
      <Card title="서브기질 분포">
        <DistBars items={subDist} />
      </Card>
      <Card title="유형별 평균 점수">
        <AvgBars avg={avg} />
      </Card>
      <Card title="문항별 응답 집계">
        <QuestionAgg rows={rows} />
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

function DistBars({ items }: { items: TypeDistItem[] }) {
  const max = Math.max(0.0001, ...items.map((i) => i.percent));
  return (
    <ul className="space-y-1.5">
      {items.map((i) => {
        const type = TYPES[i.type];
        const widthPct = (i.percent / max) * 100;
        return (
          <li key={i.type} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-right text-xs text-zinc-600">
              {type.name}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${widthPct}%`, backgroundColor: type.hex }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-zinc-500">
              {i.count}명 · {(i.percent * 100).toFixed(0)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function AvgBars({ avg }: { avg: Record<number, number> }) {
  return (
    <ul className="space-y-1.5">
      {TYPE_IDS.map((t) => {
        const type = TYPES[t];
        const v = avg[t] ?? 0;
        const pct = Math.max(0, Math.min(100, (v / MAX_SCORE) * 100));
        return (
          <li key={t} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-right text-xs text-zinc-600">
              {type.name}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: type.hex }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-zinc-500">
              {v.toFixed(1)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function QuestionAgg({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-2">
      {TYPE_IDS.map((t) => (
        <AreaAgg key={t} rows={rows} type={t} />
      ))}
    </div>
  );
}

function AreaAgg({ rows, type }: { rows: Row[]; type: number }) {
  const [open, setOpen] = useState(false);
  const agg = useMemo(
    () => (open ? areaQuestionAgg(rows, type) : null),
    [open, rows, type],
  );
  const label = AREA[type - 1];
  const info = TYPES[type];

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-zinc-50"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: info.hex }}
        />
        <span className="flex-1 text-sm font-semibold text-zinc-800">
          영역 {label} · {info.name}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-zinc-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && agg && (
        <ul className="space-y-2 border-t border-zinc-100 px-3 py-3">
          {agg.map((q) => {
            const text = QUESTIONS[type]?.[q.index - 1] ?? '';
            const barMax = Math.max(1, ...q.dist);
            return (
              <li key={q.index} className="text-xs">
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-zinc-400">
                    {q.index}
                  </span>
                  <span className="flex-1 text-zinc-700">{text}</span>
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    평균 {q.avg.toFixed(1)} · {q.count}명
                  </span>
                </div>
                <div className="ml-6 flex items-end gap-1">
                  {q.dist.map((c, i) => {
                    const h = (c / barMax) * 100;
                    return (
                      <div
                        key={i}
                        className="flex flex-1 flex-col items-center gap-0.5"
                      >
                        <div className="flex h-10 w-full items-end">
                          <div
                            className={cn(
                              'w-full rounded-t',
                              c === 0 ? 'bg-zinc-100' : 'bg-zinc-400',
                            )}
                            style={{ height: `${Math.max(3, h)}%` }}
                          />
                        </div>
                        <span className="text-[9px] leading-tight text-zinc-400">
                          {SCALE[i].replace(/\n/g, ' ')}
                        </span>
                        <span className="text-[9px] tabular-nums text-zinc-500">
                          {c}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
