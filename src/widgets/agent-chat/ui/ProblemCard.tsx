'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Send } from 'lucide-react';
import type { ProblemDraft } from '@/shared/agent/types';
import { cn } from '@/shared/lib/cn';
import { RichText } from '@/shared/ui/RichText';
import { openSourcePdf } from '@/features/open-source-pdf';
import { CitationChip } from './CitationChip';

export function ProblemCard({
  problem,
  index,
  onSubmitAnswer,
}: {
  problem: ProblemDraft;
  index: number;
  /** 출제 모드: 학생이 카드에서 직접 답을 제출 → 채팅 메시지로 전송. */
  onSubmitAnswer?: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  // 정답이 마스킹된(출제 중) 카드 + 콜백이 있을 때만 인터랙티브 폼.
  const interactive = !!onSubmitAnswer && !problem.answer && !submitted;
  const isObjective =
    (problem.problem_type ?? 'objective') === 'objective' &&
    !!problem.choices?.length;

  function submit() {
    const answer = isObjective ? picked : typed.trim();
    if (!answer || !onSubmitAnswer) return;
    setSubmitted(answer);
    onSubmitAnswer(answer);
  }

  return (
    <article className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      {problem.passage ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[14px] leading-relaxed text-zinc-800">
          <RichText text={problem.passage} />
        </div>
      ) : null}
      <header className="flex items-start gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <RichText
            text={problem.question}
            className="text-[15px] leading-relaxed text-zinc-900"
          />
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-zinc-500">
            <span className="rounded-sm bg-zinc-100 px-1.5 py-0.5">{problem.problem_type}</span>
            <span className="rounded-sm bg-zinc-100 px-1.5 py-0.5">{problem.difficulty}</span>
            {problem.topic ? (
              <span className="rounded-sm bg-zinc-100 px-1.5 py-0.5">{problem.topic}</span>
            ) : null}
          </div>
        </div>
      </header>

      {problem.figures && problem.figures.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 pl-8 sm:grid-cols-2">
          {problem.figures.map((fig, i) => (
            <figure key={i} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fig.url}
                alt={fig.caption || `그림 ${i + 1}`}
                className="w-full rounded-lg border border-zinc-200 bg-white object-contain"
              />
              {fig.caption ? (
                <figcaption className="text-center text-[11px] text-zinc-500">
                  {fig.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}

      {problem.choices && problem.choices.length > 0 ? (
        <ul className="space-y-1.5 pl-8">
          {problem.choices.map((c) => {
            const selected = picked === c.label;
            return (
              <li key={c.label}>
                {interactive && isObjective ? (
                  <button
                    type="button"
                    onClick={() => setPicked(c.label)}
                    className={cn(
                      'flex w-full items-start gap-1.5 rounded-md border px-2 py-1.5 text-left text-sm transition',
                      selected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                        : 'border-transparent text-zinc-700 hover:bg-zinc-50',
                    )}
                  >
                    <span className={cn('font-mono', selected ? 'text-indigo-600' : 'text-zinc-500')}>
                      {c.label}.
                    </span>
                    <RichText text={c.text} />
                  </button>
                ) : (
                  <span className="text-sm text-zinc-700">
                    <span className="mr-1.5 font-mono text-zinc-500">{c.label}.</span>
                    <RichText text={c.text} />
                    {submitted === c.label ? (
                      <span className="ml-1.5 text-xs text-indigo-600">← 내 답</span>
                    ) : null}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {interactive ? (
        <div className="flex items-center gap-2 border-t border-zinc-100 pt-3">
          {!isObjective ? (
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
              }}
              placeholder="답을 입력하세요"
              className="min-w-0 flex-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
            />
          ) : (
            <p className="flex-1 text-xs text-zinc-500">
              {picked ? `선택: ${picked}` : '보기를 클릭해서 답을 선택하세요'}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={isObjective ? !picked : !typed.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            <Send className="h-3 w-3" /> 답 제출
          </button>
        </div>
      ) : submitted ? (
        <p className="flex items-center gap-1 text-xs font-medium text-indigo-600">
          <CheckCircle2 className="h-3.5 w-3.5" /> 제출됨: {submitted} — 채점을 기다리는 중…
        </p>
      ) : problem.answer ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
          >
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            정답 · 해설
          </button>
          {open ? (
            <div className="space-y-2 rounded-md bg-zinc-50 p-3 text-sm">
              <p>
                <span className="mr-1 font-semibold text-emerald-700">정답</span>
                <RichText text={problem.answer} className="text-zinc-800" />
              </p>
              {problem.explanation ? (
                <RichText text={problem.explanation} className="block text-zinc-600" />
              ) : null}
              {problem.figures
                ?.filter((f) => f.explanation)
                .map((f, i) => (
                  <p key={i} className="text-zinc-600">
                    <span className="mr-1 font-semibold text-violet-700">
                      {f.caption || `그림 ${i + 1}`}
                    </span>
                    {f.explanation}
                  </p>
                ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-zinc-400">✏️ 먼저 풀어보세요 — 답을 보내면 채점해드려요</p>
      )}

      {problem.citations.length > 0 ? (
        <div className="border-t border-zinc-100 pt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            📖 출처
          </p>
          <div className="flex flex-wrap gap-1.5">
            {problem.citations.map((c, i) => (
              <CitationChip
                key={i}
                citation={c}
                onClick={(cit) => openSourcePdf(cit.sourceId, cit.page)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {problem.id ? (
        <p className="font-mono text-[10px] text-zinc-300">id · {problem.id}</p>
      ) : null}
    </article>
  );
}
