'use client';

import { useMutation } from '@tanstack/react-query';
import { saveDraft } from '../api/saveDraft';

export function useSaveDraft() {
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: Parameters<typeof saveDraft>[1] & { id: string }) =>
      saveDraft(id, payload),
  });
}
