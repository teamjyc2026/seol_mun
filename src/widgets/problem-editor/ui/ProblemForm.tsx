'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DIFFICULTIES,
  PROBLEM_TYPES,
  type Difficulty,
  type Problem,
  type ProblemChoice,
  type ProblemCitation,
  type ProblemType,
} from '@/entities/problem';
import type { Source } from '@/entities/source';
import { SourceAttachmentPicker } from './SourceAttachmentPicker';

export type ProblemFormValue = {
  topic: string;
  difficulty: Difficulty | '';
  problem_type: ProblemType;
  question: string;
  choices: ProblemChoice[];
  answer: string;
  explanation: string;
  notes: string;
  citations: ProblemCitation[];
};

export function emptyValue(): ProblemFormValue {
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
    notes: '',
    citations: [],
  };
}

export function fromProblem(p: Problem): ProblemFormValue {
  return {
    topic: p.topic ?? '',
    difficulty: (p.difficulty ?? 'medium') as Difficulty,
    problem_type: (p.problem_type ?? 'objective') as ProblemType,
    question: p.question,
    choices: p.choices ?? [],
    answer: p.answer,
    explanation: p.explanation ?? '',
    notes: p.notes ?? '',
    citations: p.citations ?? [],
  };
}

export function ProblemForm({
  value,
  onChange,
  sources,
}: {
  value: ProblemFormValue;
  onChange: (next: ProblemFormValue) => void;
  sources: Source[];
}) {
  const set = <K extends keyof ProblemFormValue>(k: K, v: ProblemFormValue[K]) =>
    onChange({ ...value, [k]: v });

  function addChoice() {
    const next = value.choices.slice();
    const labels = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
    next.push({ label: labels[next.length] ?? `${next.length + 1}.`, text: '' });
    set('choices', next);
  }
  function updChoice(i: number, patch: Partial<ProblemChoice>) {
    const next = value.choices.slice();
    next[i] = { ...next[i], ...patch };
    set('choices', next);
  }
  function rmChoice(i: number) {
    set(
      'choices',
      value.choices.filter((_, idx) => idx !== i),
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5 col-span-3 sm:col-span-1">
          <Label htmlFor="p-topic">단원 / 주제</Label>
          <Input
            id="p-topic"
            value={value.topic}
            onChange={(e) => set('topic', e.target.value)}
            placeholder="예) 임진왜란"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-diff">난이도</Label>
          <select
            id="p-diff"
            value={value.difficulty}
            onChange={(e) => set('difficulty', e.target.value as Difficulty)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-type">유형</Label>
          <select
            id="p-type"
            value={value.problem_type}
            onChange={(e) => set('problem_type', e.target.value as ProblemType)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
          >
            {PROBLEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="p-q">질문 (필수)</Label>
        <textarea
          id="p-q"
          value={value.question}
          onChange={(e) => set('question', e.target.value)}
          rows={4}
          placeholder="문제 본문"
          className="block w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none"
        />
      </div>

      {value.problem_type === 'objective' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>보기</Label>
            <button
              type="button"
              onClick={addChoice}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              <Plus className="h-3 w-3" /> 추가
            </button>
          </div>
          <ul className="space-y-1.5">
            {value.choices.map((c, i) => (
              <li key={i} className="grid grid-cols-[48px_1fr_28px] items-center gap-2">
                <Input
                  value={c.label}
                  onChange={(e) => updChoice(i, { label: e.target.value })}
                  className="h-9 text-center"
                />
                <Input
                  value={c.text}
                  onChange={(e) => updChoice(i, { text: e.target.value })}
                  placeholder="보기 내용"
                />
                <button
                  type="button"
                  onClick={() => rmChoice(i)}
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
        <Label htmlFor="p-a">정답 (필수)</Label>
        <Input
          id="p-a"
          value={value.answer}
          onChange={(e) => set('answer', e.target.value)}
          placeholder="예) ① 1592년 - 1598년"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="p-exp">해설</Label>
        <textarea
          id="p-exp"
          value={value.explanation}
          onChange={(e) => set('explanation', e.target.value)}
          rows={3}
          placeholder="(선택) 풀이 과정·근거"
          className="block w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="p-notes">내부 메모</Label>
        <textarea
          id="p-notes"
          value={value.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          placeholder="(선택) 운영자 메모"
          className="block w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none"
        />
      </div>

      <SourceAttachmentPicker
        sources={sources}
        citations={value.citations}
        onChange={(next) => set('citations', next)}
      />
    </div>
  );
}
