'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Problem } from '@/entities/problem';
import type { Source } from '@/entities/source';
import {
  emptyValue,
  fromProblem,
  ProblemForm,
  type ProblemFormValue,
} from '@/widgets/problem-editor';
import { createProblem } from '@/features/create-problem';
import { updateProblem } from '@/features/update-problem';
import { deleteProblem } from '@/features/delete-problem';

export function ProblemEditorPage({
  sources,
  initialProblem,
}: {
  sources: Source[];
  initialProblem?: Problem;
}) {
  const router = useRouter();
  const isEdit = !!initialProblem;
  const [value, setValue] = useState<ProblemFormValue>(
    initialProblem ? fromProblem(initialProblem) : emptyValue(),
  );

  const payload = () => ({
    topic: value.topic.trim() || null,
    difficulty: value.difficulty || null,
    problem_type: value.problem_type,
    question: value.question.trim(),
    choices:
      value.problem_type === 'objective'
        ? value.choices.filter((c) => c.label.trim() && c.text.trim())
        : null,
    answer: value.answer.trim(),
    explanation: value.explanation.trim() || null,
    notes: value.notes.trim() || null,
    citations: value.citations,
  });

  const create = useMutation({
    mutationFn: () => createProblem(payload()),
    onSuccess: () => {
      toast.success('문제를 저장했어요.');
      router.push('/admin/agent/problems');
    },
    onError: (e: unknown) =>
      toast.error(String((e as { message?: string })?.message ?? e)),
  });
  const update = useMutation({
    mutationFn: () => updateProblem(initialProblem!.id, payload()),
    onSuccess: () => {
      toast.success('수정했어요.');
      router.push('/admin/agent/problems');
    },
    onError: (e: unknown) =>
      toast.error(String((e as { message?: string })?.message ?? e)),
  });
  const del = useMutation({
    mutationFn: () => deleteProblem(initialProblem!.id),
    onSuccess: () => {
      toast.success('문제를 삭제했어요.');
      router.push('/admin/agent/problems');
    },
    onError: (e: unknown) =>
      toast.error(String((e as { message?: string })?.message ?? e)),
  });

  function onSave() {
    if (!value.question.trim()) {
      toast.error('질문을 입력해 주세요.');
      return;
    }
    if (!value.answer.trim()) {
      toast.error('정답을 입력해 주세요.');
      return;
    }
    if (isEdit) update.mutate();
    else create.mutate();
  }

  const pending = create.isPending || update.isPending;

  return (
    <main className="min-h-svh bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/agent/problems"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-zinc-600 transition hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" /> 라이브러리
            </Link>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900">
              {isEdit ? '문제 편집' : '새 문제 추가'}
            </h1>
          </div>
          {isEdit ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('이 문제를 삭제할까요?')) del.mutate();
              }}
              disabled={del.isPending}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" /> 삭제
            </button>
          ) : null}
        </header>

        <ProblemForm value={value} onChange={setValue} sources={sources} />

        <div className="mt-6 flex items-center justify-end gap-2">
          <Link
            href="/admin/agent/problems"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
          >
            취소
          </Link>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white shadow-md transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {pending ? '저장 중…' : isEdit ? '수정' : '저장'}
          </button>
        </div>
      </div>
    </main>
  );
}
