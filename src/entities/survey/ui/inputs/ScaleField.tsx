'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { cn } from '@/shared/lib/cn';
import { useQuestionCard } from '../QuestionCard';
import { partById } from '../../model/parts';

export function ScaleField() {
  const q = useQuestionCard();
  const { control } = useFormContext();
  const theme = partById[q.partId].theme;
  const min = q.scale?.min ?? 1;
  const max = q.scale?.max ?? 5;
  const allowEmpty = q.scale?.allowEmpty || q.optional;
  const items = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <Controller
      control={control}
      name={`answers.${q.id}` as const}
      render={({ field }) => {
        const current = field.value;
        return (
          <div>
            <div
              role="radiogroup"
              aria-label={q.title}
              className="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap"
            >
              <span className="order-1 w-full text-xs text-zinc-500 sm:order-none sm:w-auto">
                {q.scale?.minLabel}
              </span>
              <div className="order-3 flex flex-1 items-center justify-center gap-2 sm:order-none">
                {items.map((n) => {
                  const checked = current === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() =>
                        allowEmpty && checked
                          ? field.onChange(null)
                          : field.onChange(n)
                      }
                      className={cn(
                        'grid h-12 w-12 place-items-center rounded-full border-2 text-sm font-semibold transition',
                        'hover:scale-105 active:scale-95',
                        checked
                          ? cn(
                              'border-transparent text-white shadow-md',
                              theme.accentBg,
                            )
                          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300',
                      )}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <span className="order-2 w-full text-right text-xs text-zinc-500 sm:order-none sm:w-auto">
                {q.scale?.maxLabel}
              </span>
            </div>
            {allowEmpty ? (
              <button
                type="button"
                onClick={() => field.onChange(null)}
                className="mt-3 block text-xs text-zinc-400 hover:text-zinc-600 underline-offset-2 hover:underline"
              >
                선택 초기화
              </button>
            ) : null}
          </div>
        );
      }}
    />
  );
}
