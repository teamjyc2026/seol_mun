'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { scrollToNextQuestion } from '@/shared/lib/scrollToNextQuestion';
import { useQuestionCard } from '../QuestionCard';
import { partById } from '../../model/parts';

export function SelectChoice() {
  const q = useQuestionCard();
  const { control } = useFormContext();
  const theme = partById[q.partId].theme;

  if (!q.options) return null;

  return (
    <Controller
      control={control}
      name={`answers.${q.id}` as const}
      render={({ field }) => {
        const empty = !field.value;
        return (
          <div
            className={cn(
              'relative flex items-center rounded-xl border bg-white transition focus-within:ring-2',
              empty ? 'border-zinc-200' : 'border-transparent shadow-sm',
              !empty && theme.ring,
              !empty && 'ring-2',
              theme.ring,
            )}
          >
            <select
              {...field}
              value={(field.value as string) ?? ''}
              onChange={(e) => {
                field.onChange(e.target.value);
                if (e.target.value) {
                  requestAnimationFrame(() => scrollToNextQuestion(q.id));
                }
              }}
              className={cn(
                'h-11 w-full appearance-none bg-transparent px-4 pr-10 text-[15px] outline-none',
                empty ? 'text-zinc-400' : 'text-zinc-900',
              )}
            >
              <option value="" disabled>
                {q.placeholder ?? '선택해 주세요'}
              </option>
              {q.options!.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 h-4 w-4 text-zinc-400"
              aria-hidden
            />
          </div>
        );
      }}
    />
  );
}
