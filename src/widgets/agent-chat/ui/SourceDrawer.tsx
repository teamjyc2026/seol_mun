'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, RefreshCw, Plus, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/cn';
import type { Source } from '@/entities/source';
import { UploadDialog } from '@/features/upload-source';
import { deleteSource } from '@/features/delete-source';
import { reindexSource } from '@/features/reindex-source';

export function SourceDrawer({
  sources,
  open,
  onClose,
}: {
  sources: Source[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);

  const del = useMutation({
    mutationFn: deleteSource,
    onSuccess: () => {
      toast.success('소스를 삭제했어요.');
      router.refresh();
    },
    onError: (e: unknown) => toast.error(String((e as { message?: string })?.message ?? e)),
  });
  const reindex = useMutation({
    mutationFn: reindexSource,
    onSuccess: () => {
      toast.success('재인덱싱을 완료했어요.');
      router.refresh();
    },
    onError: (e: unknown) => toast.error(String((e as { message?: string })?.message ?? e)),
  });

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-zinc-200 bg-white shadow-2xl">
        <header className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
          <h2 className="text-sm font-bold text-zinc-900">소스 라이브러리</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-zinc-900 px-2 text-xs font-medium text-white hover:bg-zinc-800"
            >
              <Plus className="h-3 w-3" /> 업로드
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <ul className="space-y-2 p-3">
          {sources.length === 0 ? (
            <li className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-12 text-center text-sm text-zinc-500">
              업로드된 소스가 없어요.
            </li>
          ) : (
            sources.map((s) => (
              <li
                key={s.id}
                className="space-y-1 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900">{s.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                      {s.source_type} · {s.subject}
                      {s.grade ? ` · ${s.grade}` : ''}
                      {s.publisher ? ` · ${s.publisher}` : ''}
                      {s.year ? ` · ${s.year}` : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                      s.indexing_status === 'ready'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : s.indexing_status === 'failed'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700',
                    )}
                  >
                    {s.indexing_status}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  {s.total_pages ?? '?'}p · {s.chunk_count} chunks
                </p>
                {s.indexing_error ? (
                  <p className="rounded bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                    {s.indexing_error}
                  </p>
                ) : null}
                <div className="flex items-center justify-end gap-1 pt-1">
                  <button
                    type="button"
                    title="재인덱싱"
                    disabled={reindex.isPending}
                    onClick={() => reindex.mutate(s.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-40"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="삭제"
                    disabled={del.isPending}
                    onClick={() => {
                      if (window.confirm(`"${s.title}" 소스를 삭제할까요?`)) del.mutate(s.id);
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
      {uploadOpen ? <UploadDialog onClose={() => setUploadOpen(false)} /> : null}
    </>
  );
}
