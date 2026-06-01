'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, DatabaseBackup, FileText, Pencil, User } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/lib/formatDate';
import { Tooltip } from '@/shared/ui/Tooltip';
import type { Source } from '@/entities/source';
import { deleteSource } from '@/features/delete-source';
import { reindexSource } from '@/features/reindex-source';
import { SourceMetaForm } from '@/features/edit-source-metadata';
import { StatusBadge } from './StatusBadge';

export function SourceTable({ sources }: { sources: Source[] }) {
  if (sources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-500">
        조건에 맞는 소스가 없어요.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {sources.map((s) => (
        <SourceRow key={s.id} source={s} />
      ))}
    </ul>
  );
}

function SourceRow({ source: s }: { source: Source }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const del = useMutation({
    mutationFn: () => deleteSource(s.id),
    onSuccess: () => {
      toast.success('소스를 삭제했어요.');
      router.refresh();
    },
    onError: (e: unknown) =>
      toast.error(String((e as { message?: string })?.message ?? e)),
  });
  const reindex = useMutation({
    mutationFn: () => reindexSource(s.id),
    onSuccess: () => {
      toast.success('재인덱싱 완료');
      router.refresh();
    },
    onError: (e: unknown) =>
      toast.error(String((e as { message?: string })?.message ?? e)),
  });

  return (
    <li className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <Link
              href={`/admin/agent/sources/${s.id}`}
              className="truncate text-sm font-semibold text-zinc-900 hover:underline"
            >
              {s.title}
            </Link>
            <StatusBadge status={s.indexing_status} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
            <span>{s.source_type}</span>
            <span>·</span>
            <span className="font-medium text-zinc-600">{s.subject}</span>
            {s.grade ? (
              <>
                <span>·</span>
                <span>{s.grade}</span>
              </>
            ) : null}
            {s.publisher ? (
              <>
                <span>·</span>
                <span>{s.publisher}</span>
              </>
            ) : null}
            {s.year ? (
              <>
                <span>·</span>
                <span>{s.year}</span>
              </>
            ) : null}
            <span>·</span>
            <span>
              {s.total_pages ?? '?'}p · {s.chunk_count} chunks
            </span>
          </div>
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-zinc-500">
            <User className="h-3 w-3 text-zinc-400" />
            <span className="font-medium text-zinc-600">
              {s.author_nickname ?? (s.created_by ? '관리자' : '—')}
            </span>
            <span>·</span>
            <span>{formatDate(s.created_at)} 올림</span>
          </div>
          {s.units.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {s.units.slice(0, 6).map((u) => (
                <span
                  key={u}
                  className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700"
                >
                  {u}
                </span>
              ))}
              {s.units.length > 6 ? (
                <span className="text-[10px] text-zinc-400">+{s.units.length - 6}</span>
              ) : null}
            </div>
          ) : null}
          {s.indexing_error ? (
            <p
              className={cn(
                'mt-2 rounded px-2 py-1 text-[11px]',
                s.indexing_status === 'needs_ocr'
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-rose-50 text-rose-700',
              )}
            >
              {s.indexing_error}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip label="메타데이터·과목 편집">
            <button
              type="button"
              aria-label="편집"
              onClick={() => setEditing((v) => !v)}
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-md transition',
                editing
                  ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                  : 'text-zinc-500 hover:bg-zinc-100',
              )}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip label="교재를 다시 분석해 임베딩을 DB에 새로 적재해요">
            <button
              type="button"
              aria-label="재인덱싱"
              disabled={reindex.isPending}
              onClick={() => reindex.mutate()}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-40"
            >
              <DatabaseBackup className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <button
            type="button"
            title="삭제"
            disabled={del.isPending}
            onClick={() => {
              if (window.confirm(`"${s.title}" 소스를 삭제할까요?`)) del.mutate();
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="border-t border-zinc-100 bg-zinc-50/40 p-4">
          <SourceMetaForm source={s} onDone={() => setEditing(false)} />
        </div>
      ) : null}
    </li>
  );
}
