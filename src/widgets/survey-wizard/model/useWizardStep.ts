'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Part } from '@/entities/survey';

export function useWizardStep(parts: Part[]) {
  const router = useRouter();
  const search = useSearchParams();
  const stepParam = search.get('step');
  const initialIndex = (() => {
    if (!stepParam) return 0;
    const i = parts.findIndex((p) => p.id.toLowerCase() === stepParam.toLowerCase());
    return i === -1 ? 0 : i;
  })();
  const [index, setIndex] = useState(initialIndex);

  // keep URL in sync on internal changes
  useEffect(() => {
    const id = parts[index]?.id.toLowerCase();
    if (!id) return;
    const params = new URLSearchParams(search.toString());
    if (params.get('step') === id) return;
    params.set('step', id);
    router.replace(`?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // reflect back/forward navigation
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
