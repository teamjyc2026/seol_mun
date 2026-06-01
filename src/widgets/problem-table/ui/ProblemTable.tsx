'use client';

import Link from 'next/link';
import { Edit, Database, DatabaseZap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/cn';
import {
  DIFFICULTY_LABEL,
  PROBLEM_TYPE_LABEL,
  type Problem,
} from '@/entities/problem';
import { DeleteProblemButton } from '@/features/delete-problem';
import { api } from '@/shared/api/axios';
import { stripRichText } from '@/shared/lib/richText';
import { formatDate } from '@/shared/lib/formatDate';

function useEmbedToggle(id: string) {
  const router = useRouter();
  return useMutation({
    mutationFn: async (op: 'embed' | 'unembed') => {
      if (op === 'embed') {
        await api.post(`/agent/problems/${id}/embed`, {});
      } else {
        await api.delete(`/agent/problems/${id}/embed`);
      }
    },
    onSuccess: (_d, op) => {
      toast.success(op === 'embed' ? '임베딩 완료' : '임베딩 제거');
      router.refresh();
    },
    onError: (e: unknown) =>
      toast.error(String((e as { message?: string })?.message ?? e)),
  });
}

function EmbedButton({ problem }: { problem: Problem }) {
  const mut = useEmbedToggle(problem.id);
  const isEmbedded = !!problem.embedded_at;
  return (
    <button
      type="button"
      title={isEmbedded ? '임베딩 제거' : '임베딩 생성'}
      disabled={mut.isPending}
      onClick={(e) => {
        e.stopPropagation();
        mut.mutate(isEmbedded ? 'unembed' : 'embed');
      }}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-40',
        isEmbedded
          ? 'text-amber-500 hover:bg-amber-50'
          : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700',
      )}
    >
      {isEmbedded ? (
        <DatabaseZap className="h-3.5 w-3.5" />
      ) : (
        <Database className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

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
              <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                {p.subject}
              </span>
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
                  {DIFFICULTY_LABEL[p.difficulty]}
                </span>
              ) : null}
              {p.problem_type ? (
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700">
                  {PROBLEM_TYPE_LABEL[p.problem_type]}
                </span>
              ) : null}
              {p.embedded_at ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  <DatabaseZap className="h-2.5 w-2.5" /> 임베딩됨
                </span>
              ) : null}
              <span className="rounded-md bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-500">
                {p.created_by
                  ? `${p.author_nickname ?? (p.created_by === 'agent' ? 'AI' : '관리자')} · `
                  : ''}
                {formatDate(p.created_at)}
              </span>
            </div>
            <p className="line-clamp-2 text-sm text-zinc-800">{stripRichText(p.question)}</p>
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
            <EmbedButton problem={p} />
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
