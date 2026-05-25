'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { useQuestionCard } from '../QuestionCard';

export function ShortText() {
  const q = useQuestionCard();
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={`answers.${q.id}` as const}
      render={({ field }) => (
        <Input
          {...field}
          value={(field.value as string) ?? ''}
          placeholder={q.placeholder}
          autoComplete="off"
          className="h-11 text-[15px]"
        />
      )}
    />
  );
}
