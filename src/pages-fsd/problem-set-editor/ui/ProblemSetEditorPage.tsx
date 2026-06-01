'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Save, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  PROBLEM_TYPES,
  PROBLEM_TYPE_LABEL,
  type Difficulty,
  type ProblemChoice,
  type ProblemType,
} from '@/entities/problem';
import { SUBJECTS, type Subject } from '@/shared/config/subjects';
import { cn } from '@/shared/lib/cn';
import { useSubject } from '@/shared/store/subject';
import { RichTextPreview, RichTextHelp } from '@/shared/ui/RichText';
import { createProblemSet, type ProblemSetSubProblem } from '@/features/create-problem';

type SubBlock = {
  topic: string;
  difficulty: Difficulty;
  problem_type: ProblemType;
  question: string;
  choices: ProblemChoice[];
  answer: string;
  explanation: string;
};

function emptyBlock(): SubBlock {
  return {
    topic: '',
    difficulty: 'medium',
    problem_type: 'objective',
    question: '',
    choices: [
      { label: '①', text: '' },
      { label: '②', text: '' },
      { label: '③', text: '' },
      { label: '④', text: '' },
    ],
    answer: '',
    explanation: '',
  };
}

export function ProblemSetEditorPage() {
  const router = useRouter();
  const { subject } = useSubject();
  const [selSubject, setSelSubject] = useState<Subject>(subject);
  const [passage, setPassage] = useState('');
  const [topic, setTopic] = useState('');
  const [blocks, setBlocks] = useState<SubBlock[]>([emptyBlock()]);

  // Default to the shared 과목 until the user picks one.
  const userPickedSubject = useRef(false);
  useEffect(() => {
    if (!userPickedSubject.current) setSelSubject(subject);
  }, [subject]);

  function pickSubject(s: Subject) {
    userPickedSubject.current = true;
    setSelSubject(s);
  }
  function updateBlock(i: number, patch: Partial<SubBlock>) {
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  function updateChoice(i: number, ci: number, patch: Partial<ProblemChoice>) {
    setBlocks((prev) =>
      prev.map((b, idx) =>
        idx === i
          ? { ...b, choices: b.choices.map((c, j) => (j === ci ? { ...c, ...patch } : c)) }
          : b,
      ),
    );
  }
  function addChoice(i: number) {
    const labels = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
    setBlocks((prev) =>
      prev.map((b, idx) => {
        if (idx !== i) return b;
        const nextLabel = labels[b.choices.length] ?? `${b.choices.length + 1}.`;
        return { ...b, choices: [...b.choices, { label: nextLabel, text: '' }] };
      }),
    );
  }
  function removeChoice(i: number, ci: number) {
    setBlocks((prev) =>
      prev.map((b, idx) =>
        idx === i ? { ...b, choices: b.choices.filter((_, j) => j !== ci) } : b,
      ),
    );
  }
  function addBlock() {
    setBlocks((prev) => [...prev, emptyBlock()]);
  }
  function removeBlock(i: number) {
    setBlocks((prev) => prev.filter((_, idx) => idx !== i));
  }

  const mutation = useMutation({
    mutationFn: () => {
      if (!passage.trim()) throw new Error('지문을 입력해 주세요.');
      const problems: ProblemSetSubProblem[] = blocks.map((b) => ({
        topic: b.topic.trim() || topic.trim() || null,
        difficulty: b.difficulty,
        problem_type: b.problem_type,
        question: b.question.trim(),
        choices:
          b.problem_type === 'objective'
            ? b.choices.filter((c) => c.label.trim() && c.text.trim())
            : null,
        answer: b.answer.trim(),
        explanation: b.explanation.trim() || null,
      }));
      const missingQ = problems.findIndex((p) => !p.question);
      if (missingQ >= 0) {
        throw new Error(`문제 ${missingQ + 1}의 질문을 입력해 주세요.`);
      }
      const missingA = problems.findIndex((p) => !p.answer);
      if (missingA >= 0) {
        throw new Error(`문제 ${missingA + 1}의 정답을 입력해 주세요.`);
      }
      return createProblemSet({
        subject: selSubject,
        subjects: [selSubject],
        passage: passage.trim(),
        shared: { topic: topic.trim() || null },
        problems,
      });
    },
    onSuccess: (r) => {
      toast.success(`${r.ids.length}개 문제를 저장했어요.`);
      router.push('/admin/agent/problems');
    },
    onError: (e: unknown) =>
      toast.error(String((e as { message?: string })?.message ?? e)),
  });

  return (
    <main className="min-h-svh bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/agent/problems"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-zinc-600 transition hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" /> 문제 업로드
            </Link>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900">
              지문 세트 등록
            </h1>
          </div>
        </header>

        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          하나의 지문(독해 본문)에 여러 문제가 딸린 경우 — 영어 독해, 비문학,
          역사 사료 문제 등 — 지문을 한 번만 적고 아래에 문제들을 모아 등록합니다.
        </p>

        <section className="mb-4 space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="space-y-1.5">
            <Label>과목 (필수)</Label>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECTS.map((s) => {
                const active = selSubject === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pickSubject(s)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                      active
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="set-topic">단원 / 주제 (선택)</Label>
            <Input
              id="set-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예) 영어 독해 - 19세기 산업혁명"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="set-passage">지문 (필수)</Label>
            <textarea
              id="set-passage"
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              rows={10}
              placeholder="여기에 본문 / 사료 / 독해 지문을 그대로 붙여넣으세요."
              className="block w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none"
            />
            <p className="text-[10px] text-zinc-500">
              {passage.length.toLocaleString()}자
            </p>
            <RichTextHelp />
            <RichTextPreview value={passage} label="지문 미리보기" />
          </div>
        </section>

        <section className="space-y-3">
          {blocks.map((b, i) => (
            <article
              key={i}
              className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <header className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-zinc-900">문제 {i + 1}</h3>
                {blocks.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeBlock(i)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <X className="h-3 w-3" /> 이 문제 빼기
                  </button>
                ) : null}
              </header>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>난이도</Label>
                  <select
                    value={b.difficulty}
                    onChange={(e) =>
                      updateBlock(i, { difficulty: e.target.value as Difficulty })
                    }
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {DIFFICULTY_LABEL[d]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>유형</Label>
                  <select
                    value={b.problem_type}
                    onChange={(e) =>
                      updateBlock(i, { problem_type: e.target.value as ProblemType })
                    }
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
                  >
                    {PROBLEM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {PROBLEM_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>질문</Label>
                <textarea
                  value={b.question}
                  onChange={(e) => updateBlock(i, { question: e.target.value })}
                  rows={3}
                  placeholder="문제 본문"
                  className="block w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none"
                />
                <RichTextPreview value={b.question} />
              </div>

              {b.problem_type === 'objective' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>보기</Label>
                    <button
                      type="button"
                      onClick={() => addChoice(i)}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      <Plus className="h-3 w-3" /> 추가
                    </button>
                  </div>
                  <ul className="space-y-1.5">
                    {b.choices.map((c, ci) => (
                      <li
                        key={ci}
                        className="grid grid-cols-[48px_1fr_28px] items-center gap-2"
                      >
                        <Input
                          value={c.label}
                          onChange={(e) =>
                            updateChoice(i, ci, { label: e.target.value })
                          }
                          className="h-9 text-center"
                        />
                        <Input
                          value={c.text}
                          onChange={(e) =>
                            updateChoice(i, ci, { text: e.target.value })
                          }
                          placeholder="보기 내용"
                        />
                        <button
                          type="button"
                          onClick={() => removeChoice(i, ci)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label>정답</Label>
                {b.problem_type === 'objective' ? (
                  <select
                    value={b.answer}
                    onChange={(e) => updateBlock(i, { answer: e.target.value })}
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
                  >
                    <option value="">정답 번호 선택</option>
                    {b.choices
                      .filter((c) => c.label.trim() && c.text.trim())
                      .map((c) => (
                        <option key={c.label} value={c.label}>
                          {c.label}. {c.text}
                        </option>
                      ))}
                  </select>
                ) : (
                  <Input
                    value={b.answer}
                    onChange={(e) => updateBlock(i, { answer: e.target.value })}
                    placeholder={
                      b.problem_type === 'short'
                        ? '예) Industrial Revolution'
                        : '모범 답안'
                    }
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label>해설</Label>
                <textarea
                  value={b.explanation}
                  onChange={(e) => updateBlock(i, { explanation: e.target.value })}
                  rows={2}
                  placeholder="(선택) 풀이 근거"
                  className="block w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none"
                />
                <RichTextPreview value={b.explanation} />
              </div>
            </article>
          ))}
        </section>

        <div className="mt-3">
          <button
            type="button"
            onClick={addBlock}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <Plus className="h-3.5 w-3.5" /> 같은 지문으로 문제 추가
          </button>
        </div>

        <div className="sticky bottom-4 mt-8 flex items-center justify-end gap-2">
          <Link
            href="/admin/agent/problems"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
          >
            취소
          </Link>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white shadow-md transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {mutation.isPending ? '저장 중…' : `${blocks.length}개 문제 저장`}
          </button>
        </div>
      </div>
    </main>
  );
}
