'use client';

import { createContext, useContext } from 'react';
import type { Question } from '../../model/types';

export const QuestionCardContext = createContext<Question | null>(null);

export function useQuestionCard(): Question {
  const ctx = useContext(QuestionCardContext);
  if (!ctx) {
    throw new Error('QuestionCard.* must be used inside <QuestionCard>');
  }
  return ctx;
}
