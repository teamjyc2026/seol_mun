'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ConsentInfo,
  GiftChoice,
  SurveyAnswers,
} from '@/entities/survey';

type DraftState = {
  answers: SurveyAnswers;
  consent: ConsentInfo;
  gift: GiftChoice | null;
  stepIndex: number;
  hydrated: boolean;
  setAnswers: (a: SurveyAnswers) => void;
  setConsent: (c: ConsentInfo) => void;
  setGift: (g: GiftChoice | null) => void;
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
      gift: null,
      stepIndex: 0,
      hydrated: false,
      setAnswers: (answers) => set({ answers }),
      setConsent: (consent) => set({ consent }),
      setGift: (gift) => set({ gift }),
      setStepIndex: (stepIndex) => set({ stepIndex }),
      reset: () =>
        set({
          answers: {} as SurveyAnswers,
          consent: initialConsent,
          gift: null,
          stepIndex: 0,
        }),
    }),
    {
      name: 'seolmun:draft-v3',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (state) => ({
        answers: state.answers,
        consent: state.consent,
        gift: state.gift,
        stepIndex: state.stepIndex,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
