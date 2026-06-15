'use client';

import { Plus, X } from 'lucide-react';
import type { ProblemChoice } from '@/entities/problem';
import { cn } from '@/shared/lib/cn';
import { RichTextPreview } from '@/shared/ui/RichText';
import { TopicPicker } from './TopicPicker';

/** 한 문제의 입력 필드 (지문·그림 등 공유 항목 제외). 단일·세트 공용. */
export type WbSubProblem = {
  problem_type: 'objective' | 'short' | 'long';
  difficulty: 'easy' | 'medium' | 'hard';
  category: string | null;
  topic: string;
  question: string;
  choices: ProblemChoice[];
  /** 정답. 단답형은 줄바꿈으로 여러 답(빈칸 순서대로)을 구분한다. */
  answer: string;
  explanation: string;
};

export function emptySubProblem(): WbSubProblem {
  return {
    problem_type: 'objective',
    difficulty: 'medium',
    category: null,
    topic: '',
    question: '',
    choices: [
      { label: '①', text: '' },
      { label: '②', text: '' },
      { label: '③', text: '' },
      { label: '④', text: '' },
      { label: '⑤', text: '' },
    ],
    answer: '',
    explanation: '',
  };
}

const TYPE_LABEL: Record<WbSubProblem['problem_type'], string> = {
  objective: '객관식',
  short: '단답형',
  long: '서술형',
};
const DIFF_LABEL: Record<WbSubProblem['difficulty'], string> = {
  easy: '쉬움',
  medium: '보통',
  hard: '어려움',
};

/** 유형/난이도/분류/발문/보기/정답/해설 — 한 문제 단위 편집기. */
export function ProblemFields({
  subject,
  value,
  onChange,
}: {
  subject: string;
  value: WbSubProblem;
  onChange: (next: WbSubProblem) => void;
}) {
  const set = <K extends keyof WbSubProblem>(k: K, v: WbSubProblem[K]) =>
    onChange({ ...value, [k]: v });

  function addChoice() {
    const labels = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
    set('choices', [
      ...value.choices,
      { label: labels[value.choices.length] ?? `${value.choices.length + 1}.`, text: '' },
    ]);
  }
  function updChoice(i: number, patch: Partial<ProblemChoice>) {
    const next = value.choices.slice();
    next[i] = { ...next[i], ...patch };
    set('choices', next);
  }

  // 단답형 정답은 줄바꿈으로 여러 답(빈칸 순서대로)을 구분해 저장한다.
  const shortAnswers = value.answer.length ? value.answer.split('\n') : [''];
  const setShortAnswers = (list: string[]) => set('answer', list.join('\n'));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700">유형</label>
          <div className="flex gap-1">
            {(Object.keys(TYPE_LABEL) as WbSubProblem['problem_type'][]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set('problem_type', t)}
                className={cn(
                  'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition',
                  value.problem_type === t
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                )}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700">난이도</label>
          <div className="flex gap-1">
            {(Object.keys(DIFF_LABEL) as WbSubProblem['difficulty'][]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set('difficulty', d)}
                className={cn(
                  'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition',
                  value.difficulty === d
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                )}
              >
                {DIFF_LABEL[d]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <TopicPicker
        subject={subject}
        category={value.category}
        value={value.topic}
        onChange={({ category, topic }) => onChange({ ...value, category, topic })}
      />

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-700">발문 (필수)</label>
        <textarea
          value={value.question}
          onChange={(e) => set('question', e.target.value)}
          rows={3}
          placeholder="문제 발문"
          className="block w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none"
        />
        <RichTextPreview value={value.question} />
      </div>

      {value.problem_type === 'objective' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-700">보기</label>
            <button
              type="button"
              onClick={addChoice}
              className="inline-flex h-6 items-center gap-1 rounded-md border border-zinc-200 px-1.5 text-[11px] text-zinc-600 hover:bg-zinc-50"
            >
              <Plus className="h-3 w-3" /> 추가
            </button>
          </div>
          <ul className="space-y-1">
            {value.choices.map((c, i) => (
              <li key={i} className="grid grid-cols-[40px_1fr_24px] items-center gap-1.5">
                <input
                  value={c.label}
                  onChange={(e) => updChoice(i, { label: e.target.value })}
                  className="h-8 rounded-md border border-zinc-200 text-center text-xs outline-none"
                />
                <input
                  value={c.text}
                  onChange={(e) => updChoice(i, { text: e.target.value })}
                  placeholder="보기 내용"
                  className="h-8 rounded-md border border-zinc-200 px-2 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={() => set('choices', value.choices.filter((_, idx) => idx !== i))}
                  className="grid h-6 w-6 place-items-center rounded text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-700">
            정답 (필수{value.problem_type === 'objective' ? ' — 번호만' : ''}
            {value.problem_type === 'short' ? ' — 빈칸 순서대로' : ''})
          </label>
          {value.problem_type === 'short' && (
            <button
              type="button"
              onClick={() => setShortAnswers([...shortAnswers, ''])}
              className="inline-flex h-6 items-center gap-1 rounded-md border border-zinc-200 px-1.5 text-[11px] text-zinc-600 hover:bg-zinc-50"
            >
              <Plus className="h-3 w-3" /> 답 추가
            </button>
          )}
        </div>
        {value.problem_type === 'objective' ? (
          <div className="flex flex-wrap gap-1">
            {(value.choices.length
              ? value.choices.map((c) => c.label).filter((l) => l.trim())
              : ['①', '②', '③', '④', '⑤']
            ).map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => set('answer', value.answer === label ? '' : label)}
                className={cn(
                  'h-9 w-9 rounded-full border text-sm font-bold transition',
                  value.answer === label
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : value.problem_type === 'short' ? (
          <ul className="space-y-1">
            {shortAnswers.map((ans, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="w-12 shrink-0 text-center text-[11px] font-medium text-zinc-400">
                  빈칸 {i + 1}
                </span>
                <input
                  value={ans}
                  onChange={(e) => {
                    const next = shortAnswers.slice();
                    next[i] = e.target.value;
                    setShortAnswers(next);
                  }}
                  placeholder="예) restored"
                  className="h-8 min-w-0 flex-1 rounded-md border border-zinc-200 px-2 text-sm outline-none"
                />
                {shortAnswers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShortAnswers(shortAnswers.filter((_, idx) => idx !== i))}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <input
            value={value.answer}
            onChange={(e) => set('answer', e.target.value)}
            placeholder="모범 답안"
            className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm outline-none"
          />
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-700">해설 (선택)</label>
        <textarea
          value={value.explanation}
          onChange={(e) => set('explanation', e.target.value)}
          rows={3}
          placeholder="풀이 과정·근거"
          className="block w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none"
        />
        <RichTextPreview value={value.explanation} />
      </div>
    </div>
  );
}
