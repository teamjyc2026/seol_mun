'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, DatabaseZap, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Source, SourceChunk } from '@/entities/source';
import { SourceMetaForm } from '@/features/edit-source-metadata';
import { deleteSource } from '@/features/delete-source';
import { reindexSource } from '@/features/reindex-source';
import { api } from '@/shared/api/axios';
import { formatDate } from '@/shared/lib/formatDate';
import { Tooltip } from '@/shared/ui/Tooltip';
import { StatusBadge } from '@/widgets/source-table';

export function SourceDetailPage({
  source,
  chunks,
}: {
  source: Source;
  chunks: SourceChunk[];
}) {
  const router = useRouter();

  const reindex = useMutation({
    mutationFn: () => reindexSource(source.id),
    onSuccess: () => {
      toast.success('재인덱싱을 완료했어요.');
      router.refresh();
    },
    onError: (e: unknown) =>
      toast.error(String((e as { message?: string })?.message ?? e)),
  });

  const del = useMutation({
    mutationFn: () => deleteSource(source.id),
    onSuccess: () => {
      toast.success('소스를 삭제했어요.');
      router.push('/admin/agent/sources');
    },
    onError: (e: unknown) =>
      toast.error(String((e as { message?: string })?.message ?? e)),
  });

  async function openPdf() {
    try {
      const { data } = await api.get<{ url: string }>(
        `/agent/sources/${source.id}/signed-url`,
      );
      window.open(data.url, '_blank');
    } catch {
      toast.error('PDF URL을 가져오지 못했어요.');
    }
  }

  return (
    <main className="min-h-svh bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/agent/sources"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-zinc-600 transition hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" /> 교재 업로드
            </Link>
            <h1 className="truncate text-lg font-bold tracking-tight text-zinc-900">
              {source.title}
            </h1>
            <StatusBadge status={source.indexing_status} />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={openPdf}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              <Download className="h-3 w-3" /> PDF
            </button>
            <Tooltip label="교재를 다시 분석해 임베딩을 DB에 새로 적재해요" side="bottom">
              <button
                type="button"
                onClick={() => reindex.mutate()}
                disabled={reindex.isPending}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                <DatabaseZap className="h-3 w-3" /> 재인덱싱
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('이 소스를 삭제할까요? 청크도 함께 사라집니다.'))
                  del.mutate();
              }}
              disabled={del.isPending}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" /> 삭제
            </button>
          </div>
        </header>

        <p className="-mt-3 mb-4 text-xs text-zinc-500">
          {source.author_nickname ?? (source.created_by ? '관리자' : '—')} 올림 ·{' '}
          {formatDate(source.created_at)}
        </p>

        {source.indexing_error ? (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              source.indexing_status === 'needs_ocr'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {source.indexing_error}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900">메타데이터</h2>
            <SourceMetaForm source={source} />
          </section>

          <section className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900">
                청크 {chunks.length}개
              </h2>
              <p className="text-[11px] text-zinc-500">
                {source.total_pages ?? '?'}p · 밀도{' '}
                {source.text_density ? source.text_density.toFixed(0) : '?'} char/page
              </p>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {chunks.length === 0 ? (
                <p className="rounded-md bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-500">
                  아직 청크가 없어요. 재인덱싱이 필요할 수 있습니다.
                </p>
              ) : (
                chunks.map((c) => (
                  <article
                    key={c.id}
                    className="rounded-lg border border-zinc-100 bg-zinc-50/40 p-3"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="font-mono text-[10px] text-zinc-400">
                        p.{c.page_number ?? '?'} · #{c.chunk_index}
                      </p>
                      {(c.chapter_path ?? []).length > 0 ? (
                        <p className="text-[10px] font-medium text-indigo-600">
                          {c.chapter_path.join(' > ')}
                        </p>
                      ) : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-700">
                      {c.content.slice(0, 600)}
                      {c.content.length > 600 ? '…' : ''}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
