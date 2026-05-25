'use client';

import { createContext, useContext } from 'react';
import type { Part } from '@/entities/survey';

export type WizardCtx = {
  parts: Part[];
  index: number;
  part: Part;
  isFirst: boolean;
  isLast: boolean;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  isSubmitting?: boolean;
};

export const WizardContext = createContext<WizardCtx | null>(null);

export function useWizard(): WizardCtx {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('SurveyWizard.* must be used inside <SurveyWizard>');
  return ctx;
}
