'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ConsentInfo, SurveyAnswers } from '@/entities/survey';

type DraftState = {
  answers: SurveyAnswers;
  consent: ConsentInfo;
  stepIndex: number;
  hydrated: boolean;
  setAnswers: (a: SurveyAnswers) => void;
  setConsent: (c: ConsentInfo) => void;
  setStepIndex: (i: number) => void;
  reset: () => void;
};

const initialConsent: ConsentInfo = {
  privacy_agreed: false,
  name: '',
  phone: '',
  affiliation: '',
  email: '',
};

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      answers: {} as SurveyAnswers,
      consent: initialConsent,
      stepIndex: 0,
      hydrated: false,
      setAnswers: (answers) => set({ answers }),
      setConsent: (consent) => set({ consent }),
      setStepIndex: (stepIndex) => set({ stepIndex }),
      reset: () =>
        set({
          answers: {} as SurveyAnswers,
          consent: initialConsent,
          stepIndex: 0,
        }),
    }),
    {
      name: 'seolmun:draft-v3',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        answers: state.answers,
        consent: state.consent,
        stepIndex: state.stepIndex,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
