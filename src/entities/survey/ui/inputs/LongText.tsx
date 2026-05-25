'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { Textarea } from '@/components/ui/textarea';
import { useQuestionCard } from '../QuestionCard';

export function LongText() {
  const q = useQuestionCard();
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={`answers.${q.id}` as const}
      render={({ field }) => (
        <Textarea
          {...field}
          value={(field.value as string) ?? ''}
          placeholder={q.placeholder}
          rows={4}
          className="resize-y text-[15px] leading-relaxed"
        />
      )}
    />
  );
}
