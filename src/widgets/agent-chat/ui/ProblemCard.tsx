'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ProblemDraft } from '@/shared/agent/types';
import { cn } from '@/shared/lib/cn';
import { CitationChip } from './CitationChip';

export function ProblemCard({ problem, index }: { problem: ProblemDraft; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <header className="flex items-start gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-relaxed text-zinc-900 whitespace-pre-wrap">
            {problem.question}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-zinc-500">
            <span className="rounded-sm bg-zinc-100 px-1.5 py-0.5">{problem.problem_type}</span>
            <span className="rounded-sm bg-zinc-100 px-1.5 py-0.5">{problem.difficulty}</span>
            {problem.topic ? (
              <span className="rounded-sm bg-zinc-100 px-1.5 py-0.5">{problem.topic}</span>
            ) : null}
          </div>
        </div>
      </header>

      {problem.choices && problem.choices.length > 0 ? (
        <ul className="space-y-1.5 pl-8">
          {problem.choices.map((c) => (
            <li key={c.label} className="text-sm text-zinc-700">
              <span className="mr-1.5 font-mono text-zinc-500">{c.label}.</span>
              {c.text}
            </li>
          ))}
        </ul>
      ) : null}

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
            <span className="text-zinc-800">{problem.answer}</span>
          </p>
          {problem.explanation ? (
            <p className="text-zinc-600 whitespace-pre-wrap">{problem.explanation}</p>
          ) : null}
        </div>
      ) : null}

      {problem.citations.length > 0 ? (
        <div className="border-t border-zinc-100 pt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            📖 출처
          </p>
          <div className="flex flex-wrap gap-1.5">
            {problem.citations.map((c, i) => (
              <CitationChip key={i} citation={c} />
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
