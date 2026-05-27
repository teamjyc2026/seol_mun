'use client';

import Link from 'next/link';
import { Edit } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { Problem } from '@/entities/problem';
import { DeleteProblemButton } from '@/features/delete-problem';

export function ProblemTable({ problems }: { problems: Problem[] }) {
  if (problems.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-500">
        조건에 맞는 문제가 없어요.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {problems.map((p) => (
        <li
          key={p.id}
          className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {p.topic ? (
                <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                  {p.topic}
                </span>
              ) : null}
              {p.difficulty ? (
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                    p.difficulty === 'easy'
                      ? 'bg-emerald-50 text-emerald-700'
                      : p.difficulty === 'hard'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-amber-50 text-amber-700',
                  )}
                >
                  {p.difficulty}
                </span>
              ) : null}
              {p.problem_type ? (
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700">
                  {p.problem_type}
                </span>
              ) : null}
              {p.created_by ? (
                <span className="rounded-md bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  by {p.created_by}
                </span>
              ) : null}
            </div>
            <p className="line-clamp-2 text-sm text-zinc-800">{p.question}</p>
            {p.citations.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {p.citations.slice(0, 4).map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700"
                  >
                    📖 {c.sourceTitle ?? '소스'} p.{c.page ?? '?'}
                  </span>
                ))}
                {p.citations.length > 4 ? (
                  <span className="text-[10px] text-zinc-400">+{p.citations.length - 4}</span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={`/admin/agent/problems/${p.id}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
              title="편집"
            >
              <Edit className="h-3.5 w-3.5" />
            </Link>
            <DeleteProblemButton id={p.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}
