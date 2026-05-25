'use client';

import { useMutation } from '@tanstack/react-query';
import { submitResponse } from '../api/submitResponse';

export function useSubmitSurvey(opts?: {
  onSuccess?: (id: string) => void;
  onError?: (err: unknown) => void;
}) {
  return useMutation({
    mutationFn: submitResponse,
    onSuccess: ({ id }) => opts?.onSuccess?.(id),
    onError: (err) => opts?.onError?.(err),
  });
}
