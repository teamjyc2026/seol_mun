'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { cn } from '@/shared/lib/cn';
import { useQuestionCard } from '../QuestionCard';
import { partById } from '../../model/parts';

export function SingleChoice() {
  const q = useQuestionCard();
  const { control } = useFormContext();
  const theme = partById[q.partId].theme;

  if (!q.options) return null;

  return (
    <Controller
      control={control}
      name={`answers.${q.id}` as const}
      render={({ field }) => (
        <div
          role="radiogroup"
          aria-label={q.title}
          className="grid gap-2 sm:grid-cols-1"
        >
          {q.options!.map((opt) => {
            const checked = field.value === opt.value;
            return (
              <label
                key={opt.value}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border bg-white px-4 py-3 transition',
                  'hover:border-zinc-300 hover:bg-zinc-50',
                  checked
                    ? cn('border-transparent text-zinc-900 shadow-sm', theme.ring, 'ring-2')
                    : 'border-zinc-200 text-zinc-700',
                )}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name={field.name}
                  value={opt.value}
                  checked={checked}
                  onChange={() => field.onChange(opt.value)}
                />
                <span
                  className={cn(
                    'grid h-5 w-5 place-items-center rounded-full border-2 transition',
                    checked
                      ? cn('border-transparent', theme.accentBg)
                      : 'border-zinc-300',
                  )}
                  aria-hidden
                >
                  {checked ? (
                    <span className="h-2 w-2 rounded-full bg-white" />
                  ) : null}
                </span>
                <span className="text-sm sm:text-[15px]">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    />
  );
}
