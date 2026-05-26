'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { scrollToNextQuestion } from '@/shared/lib/scrollToNextQuestion';
import { useQuestionCard } from '../QuestionCard';
import { partById } from '../../model/parts';

export function MultiChoice() {
  const q = useQuestionCard();
  const { control } = useFormContext();
  const theme = partById[q.partId].theme;

  if (!q.options) return null;

  return (
    <Controller
      control={control}
      name={`answers.${q.id}` as const}
      render={({ field }) => {
        const value: string[] = Array.isArray(field.value) ? field.value : [];
        const atMax =
          typeof q.maxSelect === 'number' && value.length >= q.maxSelect;
        return (
          <div className="grid gap-2">
            {q.options!.map((opt) => {
              const checked = value.includes(opt.value);
              const disabled = !checked && atMax;
              return (
                <label
                  key={opt.value}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border bg-white px-4 py-3 transition',
                    !disabled && 'cursor-pointer hover:border-zinc-300 hover:bg-zinc-50',
                    disabled && 'cursor-not-allowed opacity-50',
                    checked
                      ? cn('border-transparent shadow-sm', theme.ring, 'ring-2')
                      : 'border-zinc-200 text-zinc-700',
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    name={field.name}
                    value={opt.value}
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const nextValue = [...value, opt.value];
                        field.onChange(nextValue);
                        if (
                          typeof q.maxSelect === 'number' &&
                          nextValue.length === q.maxSelect
                        ) {
                          requestAnimationFrame(() => scrollToNextQuestion(q.id));
                        }
                      } else {
                        field.onChange(value.filter((v) => v !== opt.value));
                      }
                    }}
                  />
                  <span
                    className={cn(
                      'grid h-5 w-5 place-items-center rounded-md border-2 transition',
                      checked
                        ? cn('border-transparent', theme.accentBg)
                        : 'border-zinc-300',
                    )}
                    aria-hidden
                  >
                    {checked ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                  </span>
                  <span className="text-sm sm:text-[15px]">{opt.label}</span>
                </label>
              );
            })}
            {typeof q.maxSelect === 'number' ? (
              <p className="mt-1 text-right text-xs text-zinc-500">
                {value.length} / {q.maxSelect}
              </p>
            ) : null}
          </div>
        );
      }}
    />
  );
}
