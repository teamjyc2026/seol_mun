'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Database, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useMergeState } from '@/shared/lib/mergeReducer';

/** API 화이트리스트와 동일 — 원본을 들여다볼 테이블. */
const TABLES = [
  'problems',
  'sources',
  'source_chunks',
  'workbench_jobs',
  'workbench_boxes',
  'workbench_attachments',
  'exam_scopes',
  'exam_scope_sources',
  'exam_scope_problems',
  'schools',
] as const;

type Row = Record<string, unknown>;

function cellValue(v: unknown): string {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

export function DbViewerPage() {
  const [s, set] = useMergeState({
    table: 'problems' as (typeof TABLES)[number],
    rows: [] as Row[],
    count: 0,
    limit: 25,
    offset: 0,
    loading: false,
    expanded: new Set<number>(),
  });

  async function load(table: (typeof TABLES)[number], offset: number) {
    set({ loading: true });
    try {
      const res = await fetch(
        `/api/admin/db?table=${encodeURIComponent(table)}&limit=${s.limit}&offset=${offset}`,
      );
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '조회 실패');
      const data = (await res.json()) as { rows: Row[]; count: number };
      set({ rows: data.rows ?? [], count: data.count ?? 0, offset, expanded: new Set() });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '조회 실패');
    } finally {
      set({ loading: false });
    }
  }

  useEffect(() => {
    void load('problems', 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickTable(t: (typeof TABLES)[number]) {
    set({ table: t });
    void load(t, 0);
  }

  function toggle(i: number) {
    const next = new Set(s.expanded);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    set({ expanded: next });
  }

  const pageStart = s.count === 0 ? 0 : s.offset + 1;
  const pageEnd = Math.min(s.offset + s.limit, s.count);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center gap-2">
        <Database className="h-5 w-5 text-zinc-700" />
        <h1 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">DB 뷰어</h1>
        <p className="ml-2 text-xs text-zinc-500">원본 테이블 행을 그대로 봐요 (읽기 전용).</p>
        <button
          type="button"
          onClick={() => void load(s.table, s.offset)}
          className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-xs text-zinc-600 hover:bg-zinc-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> 새로고침
        </button>
      </header>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABLES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => pickTable(t)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition',
              s.table === t
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {s.table} · 총 {s.count}행 {s.count > 0 && `(${pageStart}–${pageEnd})`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={s.offset === 0 || s.loading}
            onClick={() => void load(s.table, Math.max(0, s.offset - s.limit))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={s.offset + s.limit >= s.count || s.loading}
            onClick={() => void load(s.table, s.offset + s.limit)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {s.loading ? (
        <div className="grid h-32 place-items-center rounded-xl border border-zinc-200 bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : s.rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          행이 없어요.
        </div>
      ) : (
        <ul className="space-y-2">
          {s.rows.map((row, i) => {
            const open = s.expanded.has(i);
            const id = (row.id ?? row.scope_id ?? '') as string;
            const preview =
              (row.title as string) ||
              (row.question as string) ||
              (row.name as string) ||
              (row.content as string) ||
              id;
            return (
              <li key={i} className="rounded-lg border border-zinc-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
                >
                  <ChevronRight
                    className={cn('h-3.5 w-3.5 shrink-0 text-zinc-400 transition', open && 'rotate-90')}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-zinc-700">
                    {typeof preview === 'string' ? preview.slice(0, 120) : String(preview)}
                  </span>
                  {typeof id === 'string' && id && (
                    <code className="shrink-0 text-[10px] text-zinc-400">{id.slice(0, 8)}</code>
                  )}
                </button>
                {open && (
                  <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 border-t border-zinc-100 px-3 py-2 text-xs">
                    {Object.entries(row).map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="font-mono font-medium text-zinc-500">{k}</dt>
                        <dd className="min-w-0 overflow-x-auto whitespace-pre-wrap break-words font-mono text-zinc-800">
                          {cellValue(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
