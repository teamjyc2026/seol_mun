'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, LogOut, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { ResponseRow as Row } from '@/entities/response';
import { ExportButton } from '@/features/admin-export';
import {
  FilterBar,
  type DateRange,
  type SortKey,
  type StatusFilter,
} from './FilterBar';
import { ResponseRow } from './ResponseRow';
import { QuestionSummary } from './QuestionSummary';

type Tab = 'list' | 'agg';

function within(iso: string, ms: number) {
  return Date.now() - new Date(iso).getTime() < ms;
}

const RANGE_MS: Record<DateRange, number | null> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  all: null,
};

export function AdminDashboard({ responses }: { responses: Row[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('list');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<DateRange>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('created_desc');
  const [loggingOut, setLoggingOut] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const limit = RANGE_MS[range];
    let arr = responses.slice();
    if (limit != null) arr = arr.filter((r) => within(r.created_at, limit));
    if (status !== 'all') arr = arr.filter((r) => r.status === status);
    if (needle) {
      arr = arr.filter((r) =>
        [r.name, r.email, r.phone, r.affiliation]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    arr.sort((a, b) => {
      if (sort === 'created_desc') return b.created_at.localeCompare(a.created_at);
      if (sort === 'created_asc') return a.created_at.localeCompare(b.created_at);
      return (a.name ?? '').localeCompare(b.name ?? '', 'ko');
    });
    return arr;
  }, [responses, query, range, status, sort]);

  const stats = useMemo(
    () => ({
      total: responses.length,
      submitted: responses.filter((r) => r.status === 'submitted').length,
      last24h: responses.filter((r) =>
        within(r.created_at, 24 * 60 * 60 * 1000),
      ).length,
    }),
    [responses],
  );

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  return (
    <main className="min-h-svh bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              설문 응답 대시보드
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              제출된 응답을 확인하고 엑셀로 내보내거나 문항별로 집계해 볼 수 있어요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/enneagram"
              title="에니어그램 검사 결과"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-medium text-violet-700 shadow-sm transition hover:bg-violet-100"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>② 에니어그램 검사 결과</span>
            </Link>
            <Link
              href="/admin/agent"
              title="에이전트"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-100"
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">에이전트</span>
            </Link>
            <Link
              href="/admin/new"
              title="응답 추가"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">응답 추가</span>
            </Link>
            <ExportButton />
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              title="로그아웃"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-3 gap-3">
          <Stat label="전체 응답" value={stats.total} />
          <Stat label="제출 완료" value={stats.submitted} />
          <Stat label="최근 24시간" value={stats.last24h} highlight />
        </section>

        <nav
          role="tablist"
          aria-label="대시보드 탭"
          className="mb-4 inline-flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white p-0.5 shadow-sm"
        >
          {(
            [
              { id: 'list', label: '응답 목록' },
              { id: 'agg', label: '문항별 집계' },
            ] as { id: Tab; label: string }[]
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  'h-8 rounded-md px-3 text-sm font-medium transition',
                  active
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-100',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        <FilterBar
          query={query}
          onQueryChange={setQuery}
          range={range}
          onRangeChange={setRange}
          status={status}
          onStatusChange={setStatus}
          sort={sort}
          onSortChange={setSort}
        />

        <p className="mb-3 text-xs text-zinc-500">
          필터 적용: <span className="font-semibold text-zinc-700">{filtered.length}</span>건
        </p>

        {tab === 'list' ? (
          filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-500">
              조건에 맞는 응답이 없어요.
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((r) => (
                <ResponseRow key={r.id} row={r} />
              ))}
            </ul>
          )
        ) : (
          <QuestionSummary responses={filtered} />
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4 shadow-sm',
        highlight ? 'border-emerald-200' : 'border-zinc-200',
      )}
    >
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-bold tracking-tight',
          highlight ? 'text-emerald-600' : 'text-zinc-900',
        )}
      >
        {value}
      </p>
    </div>
  );
}
