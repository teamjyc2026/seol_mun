'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { cn } from '@/shared/lib/cn';
import { scrollToNextQuestion } from '@/shared/lib/scrollToNextQuestion';
import { useQuestionCard } from '../QuestionCard';
import { partById } from '../../model/parts';

type RankMap = Record<string, string>; // { '1': value, '2': value, ... }

function rankOf(value: string, map: RankMap): number | null {
  for (const [rank, val] of Object.entries(map)) {
    if (val === value) return Number(rank);
  }
  return null;
}

function renumberAfterRemove(map: RankMap, removedRank: number): RankMap {
  const next: RankMap = {};
  let cursor = 1;
  const ranks = Object.keys(map)
    .map(Number)
    .filter((r) => r !== removedRank)
    .sort((a, b) => a - b);
  for (const r of ranks) {
    next[String(cursor++)] = map[String(r)];
  }
  return next;
}

export function RankPicker() {
  const q = useQuestionCard();
  const { control } = useFormContext();
  const theme = partById[q.partId].theme;
  const max = q.rank?.max ?? (q.options?.length ?? 0);

  if (!q.options) return null;

  return (
    <Controller
      control={control}
      name={`answers.${q.id}` as const}
      render={({ field }) => {
        const map: RankMap =
          field.value && typeof field.value === 'object' && !Array.isArray(field.value)
            ? (field.value as RankMap)
            : {};
        const filled = Object.keys(map).length;
        return (
          <div className="space-y-2">
            {q.options!.map((opt) => {
              const rank = rankOf(opt.value, map);
              const isFull = filled >= max && rank === null;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isFull}
                  onClick={() => {
                    if (rank !== null) {
                      field.onChange(renumberAfterRemove(map, rank));
                    } else if (filled < max) {
                      const nextRank = filled + 1;
                      field.onChange({ ...map, [String(nextRank)]: opt.value });
                      if (nextRank === max) {
                        requestAnimationFrame(() => scrollToNextQuestion(q.id));
                      }
                    }
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left transition',
                    !isFull && 'hover:border-zinc-300 hover:bg-zinc-50',
                    isFull && 'cursor-not-allowed opacity-50',
                    rank !== null
                      ? cn('border-transparent shadow-sm', theme.ring, 'ring-2')
                      : 'border-zinc-200',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold',
                      rank !== null
                        ? cn('border-transparent text-white', theme.accentBg)
                        : 'border-zinc-200 text-zinc-400',
                    )}
                    aria-hidden
                  >
                    {rank ?? '·'}
                  </span>
                  <span className="text-sm sm:text-[15px]">{opt.label}</span>
                  {rank !== null ? (
                    <span className="ml-auto text-xs font-medium text-zinc-500">
                      {rank}순위
                    </span>
                  ) : null}
                </button>
              );
            })}
            <p className="mt-2 text-right text-xs text-zinc-500">
              {filled} / {max} 선택
            </p>
          </div>
        );
      }}
    />
  );
}
