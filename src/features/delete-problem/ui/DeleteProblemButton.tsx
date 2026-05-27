'use client';

import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deleteProblem } from '../api/deleteProblem';

export function DeleteProblemButton({ id }: { id: string }) {
  const router = useRouter();
  const mut = useMutation({
    mutationFn: () => deleteProblem(id),
    onSuccess: () => {
      toast.success('문제를 삭제했어요.');
      router.refresh();
    },
    onError: (e: unknown) =>
      toast.error(String((e as { message?: string })?.message ?? e)),
  });
  return (
    <button
      type="button"
      title="삭제"
      disabled={mut.isPending}
      onClick={(e) => {
        e.stopPropagation();
        if (window.confirm('이 문제를 삭제할까요?')) mut.mutate();
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
