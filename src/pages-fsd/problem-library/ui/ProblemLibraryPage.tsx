'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  PROBLEM_TYPES,
  PROBLEM_TYPE_LABEL,
  type Difficulty,
  type Problem,
  type ProblemType,
} from '@/entities/problem';
import { ProblemTable } from '@/widgets/problem-table';
import { AdminAccountMenu } from '@/widgets/admin-account-menu';

type LocalFilters = {
  search: string;
  difficulty: Difficulty | '';
  problem_type: ProblemType | '';
  topic: string;
};

const INITIAL: LocalFilters = {
  search: '',
  difficulty: '',
  problem_type: '',
  topic: '',
};

export function ProblemLibraryPage({
  initialProblems,
}: {
  initialProblems: Problem[];
}) {
  const [filters, setFilters] = useState<LocalFilters>(INITIAL);

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    const topic = filters.topic.trim().toLowerCase();
    return initialProblems.filter((p) => {
      if (filters.difficulty && p.difficulty !== filters.difficulty) return false;
      if (filters.problem_type && p.problem_type !== filters.problem_type) return false;
      if (topic && !(p.topic ?? '').toLowerCase().includes(topic)) return false;
      if (term) {
        const hay = `${p.question} ${p.answer} ${p.explanation ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [initialProblems, filters]);

  return (
    <main className="min-h-svh bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/agent"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-zinc-600 transition hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" /> 에이전트
            </Link>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900">
              📝 문제 업로드
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/agent/problems/new-set"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
              title="지문 1개 + 딸린 문제 여러 개"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">지문 세트</span>
            </Link>
            <Link
              href="/admin/agent/problems/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white shadow-md transition hover:bg-zinc-800"
              title="지문 없는 문제 1개"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">낱개 문제</span>
            </Link>
            <AdminAccountMenu />
          </div>
        </header>

        <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 shadow-sm focus-within:ring-2 focus-within:ring-zinc-300">
            <Search className="h-4 w-4 text-zinc-400" />
            <Input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="질문·정답·해설 검색"
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <Input
            value={filters.topic}
            onChange={(e) => setFilters((f) => ({ ...f, topic: e.target.value }))}
            placeholder="단원"
            className="h-9 w-32"
          />
          <select
            value={filters.difficulty}
            onChange={(e) =>
              setFilters((f) => ({ ...f, difficulty: e.target.value as Difficulty | '' }))
            }
            className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-xs"
          >
            <option value="">(모든 난이도)</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
          <select
            value={filters.problem_type}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                problem_type: e.target.value as ProblemType | '',
              }))
            }
            className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-xs"
          >
            <option value="">(모든 유형)</option>
            {PROBLEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROBLEM_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <p className="mb-3 text-xs text-zinc-500">
          필터 적용: <span className="font-semibold text-zinc-700">{filtered.length}</span>건
        </p>

        <ProblemTable problems={filtered} />
      </div>
    </main>
  );
}
