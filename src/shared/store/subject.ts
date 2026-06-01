'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SUBJECT, SUBJECTS, type Subject } from '@/shared/config/subjects';

type SubjectState = {
  subject: Subject;
  setSubject: (s: Subject) => void;
};

/**
 * Shared "현재 과목" across the agent chat, 교재 업로드, and 문제 업로드.
 * Persisted to localStorage so a pick in one place carries to the others.
 */
export const useSubjectStore = create<SubjectState>()(
  persist(
    (set) => ({
      subject: DEFAULT_SUBJECT,
      setSubject: (subject) => set({ subject }),
    }),
    {
      name: 'seolmun:subject',
      // Hydrate manually on the client (see useSubject) to avoid SSR mismatch.
      skipHydration: true,
      merge: (persisted, current) => {
        const s = (persisted as Partial<SubjectState> | undefined)?.subject;
        const valid = s != null && (SUBJECTS as readonly string[]).includes(s);
        return { ...current, subject: valid ? (s as Subject) : current.subject };
      },
    },
  ),
);

/**
 * Reactive accessor for the shared subject. Rehydrates from localStorage on
 * mount, so server render and first client render both use the default
 * (no hydration mismatch), then the stored value is applied.
 */
export function useSubject(): SubjectState {
  useEffect(() => {
    void useSubjectStore.persist.rehydrate();
  }, []);
  return useSubjectStore();
}
