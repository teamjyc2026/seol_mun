'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { deleteResponse } from '../api/deleteResponse';

export function DeleteButton({
  id,
  label,
}: {
  id: string;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const mutation = useMutation({
    mutationFn: () => deleteResponse(id),
    onSuccess: () => {
      toast.success('응답을 삭제했어요.');
      startTransition(() => router.refresh());
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : '삭제에 실패했어요.';
      toast.error(msg);
    },
  });

  return (
    <button
      type="button"
      aria-label={label ?? '응답 삭제'}
      title="응답 삭제"
      disabled={mutation.isPending || isPending}
      onClick={(e) => {
        e.stopPropagation();
        if (!window.confirm('이 응답을 삭제할까요? 되돌릴 수 없습니다.')) return;
        mutation.mutate();
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
