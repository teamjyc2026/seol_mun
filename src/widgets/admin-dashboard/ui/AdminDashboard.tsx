'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { ResponseRow as Row } from '@/entities/response';
import { ResponseRow } from './ResponseRow';

function within24h(iso: string) {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

export function AdminDashboard({ responses }: { responses: Row[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return responses;
    return responses.filter((r) =>
      [r.name, r.email, r.phone, r.affiliation]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [responses, q]);

  const stats = useMemo(
    () => ({
      total: responses.length,
      submitted: responses.filter((r) => r.status === 'submitted').length,
      last24h: responses.filter((r) => within24h(r.created_at)).length,
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
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              설문 응답 대시보드
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              제출된 응답을 확인하고 상세 답변을 펼쳐볼 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            로그아웃
          </button>
        </header>

        <section className="mb-6 grid grid-cols-3 gap-3">
          <Stat label="전체 응답" value={stats.total} />
          <Stat label="제출 완료" value={stats.submitted} />
          <Stat label="최근 24시간" value={stats.last24h} highlight />
        </section>

        <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 shadow-sm focus-within:ring-2 focus-within:ring-zinc-300">
          <Search className="h-4 w-4 text-zinc-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름·이메일·연락처·소속으로 검색"
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-500">
            응답이 없어요.
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((r) => (
              <ResponseRow key={r.id} row={r} />
            ))}
          </ul>
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
      className={
        'rounded-xl border bg-white p-4 shadow-sm ' +
        (highlight ? 'border-emerald-200' : 'border-zinc-200')
      }
    >
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={
          'mt-1 text-2xl font-bold tracking-tight ' +
          (highlight ? 'text-emerald-600' : 'text-zinc-900')
        }
      >
        {value}
      </p>
    </div>
  );
}
