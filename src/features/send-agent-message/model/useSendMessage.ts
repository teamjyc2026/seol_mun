'use client';

import { useMutation } from '@tanstack/react-query';
import { sendAgentMessage } from '../api/sendMessage';

export function useSendAgentMessage(opts?: {
  onSuccess?: (r: Awaited<ReturnType<typeof sendAgentMessage>>) => void;
  onError?: (err: unknown) => void;
}) {
  return useMutation({
    mutationFn: sendAgentMessage,
    onSuccess: opts?.onSuccess,
    onError: opts?.onError,
  });
}
