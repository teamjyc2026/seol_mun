'use client';

import { useMutation } from '@tanstack/react-query';
import {
  submitEnneagram,
  type SubmitEnneagramResult,
} from '../api/submitEnneagram';

export function useSubmitEnneagram(opts?: {
  onSuccess?: (result: SubmitEnneagramResult) => void;
  onError?: (err: unknown) => void;
}) {
  return useMutation({
    mutationFn: submitEnneagram,
    onSuccess: (result) => opts?.onSuccess?.(result),
    onError: (err) => opts?.onError?.(err),
  });
}
