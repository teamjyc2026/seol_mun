'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  GRADES,
  SOURCE_TYPES,
  type Grade,
  type Source,
  type SourceChunk,
  type SourceType,
} from '@/entities/source';
import { editSourceMetadata } from '@/features/edit-source-metadata';
import { deleteSource } from '@/features/delete-source';
import { reindexSource } from '@/features/reindex-source';
import { api } from '@/shared/api/axios';
import { StatusBadge } from '@/widgets/source-table';

export function SourceDetailPage({
  source,
  chunks,
}: {
  source: Source;
  chunks: SourceChunk[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: source.title,
    source_type: source.source_type,
    subject: source.subject,
    grade: source.grade ?? '',
    publisher: source.publisher ?? '',
    year: source.year ? String(source.year) : '',
    author: source.author ?? '',
    edition: source.edition ?? '',
    isbn: source.isbn ?? '',
    description: source.description ?? '',
    unitsRaw: (source.units ?? []).join(', '),
    tagsRaw: (source.tags ?? []).join(', '),
  });

  const save = useMutation({
    mutationFn: () =>
      editSourceMetadata(source.id, {
        title: form.title,
        source_type: form.source_type as SourceType,
        subject: form.subject,
        grade: (form.grade || null) as Grade | null,
        publisher: form.publisher || null,
        year: form.year ? Number(form.year) : null,
        author: form.author || null,
        edition: form.edition || null,
        isbn: form.isbn || null,
        description: form.description || null,
        units: form.unitsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        tags: form.tagsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast.success('메타데이터를 저장했어요.');
      router.refresh();
    },
    onError: (e: unknown) =>
      toast.error(String((e as { message?: string })?.message ?? e)),
  });

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
    } catch (e) {
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
            <button
              type="button"
              onClick={() => reindex.mutate()}
              disabled={reindex.isPending}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" /> 재인덱싱
            </button>
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
            <Field label="제목">
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="유형">
                <select
                  value={form.source_type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, source_type: e.target.value as SourceType }))
                  }
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
                >
                  {SOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="학년">
                <select
                  value={form.grade}
                  onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value as Grade | '' }))}
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
                >
                  <option value="">(없음)</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="출판사">
                <Input
                  value={form.publisher}
                  onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))}
                />
              </Field>
              <Field label="출판년도">
                <Input
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="저자">
                <Input
                  value={form.author}
                  onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                />
              </Field>
              <Field label="판본">
                <Input
                  value={form.edition}
                  onChange={(e) => setForm((f) => ({ ...f, edition: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="ISBN">
              <Input
                value={form.isbn}
                onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value }))}
              />
            </Field>
            <Field label="책 단원/키워드 (쉼표 구분)">
              <Input
                value={form.unitsRaw}
                onChange={(e) => setForm((f) => ({ ...f, unitsRaw: e.target.value }))}
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                기본은 PDF 목차에서 자동(오른쪽 청크 단원). 보조 키워드로 임베딩에
                항상 함께 들어가요. 변경 후 재인덱싱 권장.
              </p>
            </Field>
            <Field label="태그 (쉼표 구분)">
              <Input
                value={form.tagsRaw}
                onChange={(e) => setForm((f) => ({ ...f, tagsRaw: e.target.value }))}
              />
            </Field>
            <Field label="메모">
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="block w-full resize-y rounded-md border border-zinc-200 px-2 py-1.5 text-sm outline-none"
              />
            </Field>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white shadow-md hover:bg-zinc-800 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {save.isPending ? '저장 중…' : '저장'}
            </button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-zinc-700">{label}</Label>
      {children}
    </div>
  );
}
