'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Part } from '@/entities/survey';
import { useDraftStore } from '@/shared/lib/draftStore';

export function useWizardStep(parts: Part[]) {
  const router = useRouter();
  const search = useSearchParams();
  const stepParam = search.get('step');

  const storedIndex = useDraftStore((s) => s.stepIndex);
  const hydrated = useDraftStore((s) => s.hydrated);
  const setStoredIndex = useDraftStore((s) => s.setStepIndex);

  const initialIndex = (() => {
    if (stepParam) {
      const i = parts.findIndex((p) => p.id.toLowerCase() === stepParam.toLowerCase());
      if (i !== -1) return i;
    }
    return 0;
  })();
  const [index, setIndex] = useState(initialIndex);

  // After zustand rehydrates, restore step if URL didn't override
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !hydrated) return;
    restored.current = true;
    if (!stepParam && storedIndex > 0 && storedIndex < parts.length) {
      setIndex(storedIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Sync index → URL and store
  useEffect(() => {
    const id = parts[index]?.id.toLowerCase();
    if (!id) return;
    setStoredIndex(index);
    const params = new URLSearchParams(search.toString());
    if (params.get('step') === id) return;
    params.set('step', id);
    router.replace(`?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Reflect browser back/forward
  useEffect(() => {
    if (!stepParam) return;
    const i = parts.findIndex((p) => p.id.toLowerCase() === stepParam.toLowerCase());
    if (i !== -1 && i !== index) setIndex(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepParam]);

  const goTo = useCallback(
    (i: number) => setIndex(Math.max(0, Math.min(parts.length - 1, i))),
    [parts.length],
  );

  return {
    index,
    part: parts[index],
    isFirst: index === 0,
    isLast: index === parts.length - 1,
    total: parts.length,
    next: () => goTo(index + 1),
    prev: () => goTo(index - 1),
    goTo,
  };
}
