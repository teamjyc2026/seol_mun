'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  GRADES,
  SOURCE_TYPES,
  type Grade,
  type Source,
  type SourceType,
} from '@/entities/source';
import { SUBJECTS } from '@/shared/config/subjects';
import { editSourceMetadata } from '../api/editSourceMetadata';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-zinc-700">{label}</Label>
      {children}
    </div>
  );
}

const SELECT_CLS = 'h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm';

/** Shared 교재 메타데이터 편집 폼 — 상세 페이지와 목록 인라인 편집이 함께 사용. */
export function SourceMetaForm({
  source,
  onDone,
}: {
  source: Source;
  onDone?: () => void;
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
        units: form.unitsRaw.split(',').map((s) => s.trim()).filter(Boolean),
        tags: form.tagsRaw.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      toast.success('메타데이터를 저장했어요.');
      router.refresh();
      onDone?.();
    },
    onError: (e: unknown) =>
      toast.error(String((e as { message?: string })?.message ?? e)),
  });

  return (
    <div className="space-y-3">
      <Field label="제목">
        <Input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
      </Field>
      <Field label="과목">
        <select
          value={form.subject}
          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          className={SELECT_CLS}
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-zinc-500">
          저장하면 즉시 반영돼요. 에이전트는 선택한 과목의 교재만 검색합니다.
        </p>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="유형">
          <select
            value={form.source_type}
            onChange={(e) =>
              setForm((f) => ({ ...f, source_type: e.target.value as SourceType }))
            }
            className={SELECT_CLS}
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
            className={SELECT_CLS}
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
          기본은 PDF 목차에서 자동. 보조 키워드로 임베딩에 함께 들어가요. 변경 후 재인덱싱 권장.
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
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white shadow-md hover:bg-zinc-800 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {save.isPending ? '저장 중…' : '저장'}
        </button>
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            <X className="h-3.5 w-3.5" /> 취소
          </button>
        ) : null}
      </div>
    </div>
  );
}
