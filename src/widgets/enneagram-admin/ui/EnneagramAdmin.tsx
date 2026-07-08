'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronDown,
  ClipboardList,
  Download,
  LogOut,
  MoreVertical,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import {
  AREA,
  QUESTIONS,
  SCALE,
  SHEETS,
  TYPES,
  type EnneagramResponseRow as Row,
} from '@/entities/enneagram';
import {
  EnneaFilterBar,
  type EnneaDateRange,
  type EnneaSortKey,
  type TopTypeFilter,
} from './EnneaFilterBar';
import { EnneaSummary } from './EnneaSummary';

const RANGE_MS: Record<Exclude<EnneaDateRange, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function totalScore(r: Row): number {
  if (typeof r.total === 'number' && r.total > 0) return r.total;
  return Object.values(r.scores ?? {}).reduce((a, b) => a + b, 0);
}

const TYPE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const MAX_SCORE = 75;

function fmtTs(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EnneagramAdmin({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<EnneaDateRange>('all');
  const [sort, setSort] = useState<EnneaSortKey>('created_desc');
  const [topType, setTopType] = useState<TopTypeFilter>('all');
  const [tab, setTab] = useState<'list' | 'summary'>('list');
  const [loggingOut, setLoggingOut] = useState(false);
  const [localRows, setLocalRows] = useState<Row[]>(rows);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const now = Date.now();
    let arr = localRows.slice();

    if (range !== 'all') {
      const cutoff = now - RANGE_MS[range];
      arr = arr.filter((r) => new Date(r.created_at).getTime() >= cutoff);
    }
    if (topType !== 'all') {
      arr = arr.filter((r) => r.top_type === topType);
    }
    if (needle) {
      arr = arr.filter((r) =>
        [r.name, r.school, r.phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }

    arr.sort((a, b) => {
      switch (sort) {
        case 'name_asc':
          return (a.name ?? '').localeCompare(b.name ?? '', 'ko');
        case 'total_desc':
          return totalScore(b) - totalScore(a);
        case 'created_desc':
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
    return arr;
  }, [localRows, query, range, sort, topType]);

  const stats = useMemo(() => {
    const total = localRows.length;
    const counts = new Map<number, number>();
    for (const r of localRows) {
      counts.set(r.top_type, (counts.get(r.top_type) ?? 0) + 1);
    }
    let topType: number | null = null;
    let topCount = 0;
    for (const [t, c] of counts) {
      if (c > topCount) {
        topCount = c;
        topType = t;
      }
    }
    const distinctNames = new Set(
      localRows.map((r) => (r.name ?? '').trim()).filter(Boolean),
    ).size;
    return {
      total,
      topTypeLabel: topType ? TYPES[topType].name : '—',
      topTypeHex: topType ? TYPES[topType].hex : '#71717a',
      distinctNames,
    };
  }, [localRows]);

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  async function onDelete(id: string) {
    if (!confirm('이 검사 결과를 삭제할까요? 되돌릴 수 없어요.')) return;
    const res = await fetch(`/api/admin/enneagram/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setLocalRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      alert('삭제에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  return (
    <main className="min-h-svh bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              에니어그램 검사 결과
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              신입생 이벤트로 접수된 학생 기질검사 결과예요. 학생을 눌러 세부
              결과를 확인하고 엑셀로 내보낼 수 있어요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin"
              title="설문 선택"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">설문 선택</span>
            </Link>
            <Link
              href="/admin/tutor"
              title="학습 튜터 설문"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">① 학습 튜터 설문</span>
            </Link>
            <button
              type="button"
              onClick={() => router.refresh()}
              title="새로고침"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">새로고침</span>
            </button>
            <a
              href="/api/admin/enneagram/export"
              download
              title="엑셀 내보내기"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">엑셀 내보내기</span>
            </a>
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
          <Stat label="전체 검사 수" value={String(stats.total)} />
          <Stat
            label="가장 많은 주요기질"
            value={stats.topTypeLabel}
            accentHex={stats.topTypeHex}
          />
          <Stat label="검사한 학생 수" value={String(stats.distinctNames)} highlight />
        </section>

        <div className="mb-4 inline-flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white p-0.5 shadow-sm">
          {(
            [
              ['list', '결과 목록'],
              ['summary', '유형별 집계'],
            ] as const
          ).map(([value, label]) => {
            const active = tab === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                aria-pressed={active}
                className={cn(
                  'h-8 rounded-md px-3 text-sm font-medium transition',
                  active
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-100',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <EnneaFilterBar
          query={query}
          onQueryChange={setQuery}
          range={range}
          onRangeChange={setRange}
          sort={sort}
          onSortChange={setSort}
          topType={topType}
          onTopTypeChange={setTopType}
        />

        <p className="mb-3 text-xs text-zinc-500">
          표시:{' '}
          <span className="font-semibold text-zinc-700">{filtered.length}</span>건
        </p>

        {tab === 'summary' ? (
          <EnneaSummary rows={filtered} />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-500">
            {localRows.length === 0
              ? '아직 접수된 검사 결과가 없어요.'
              : '검색·필터 조건에 맞는 결과가 없어요.'}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((r) => (
              <ResultCard key={r.id} row={r} onDelete={onDelete} />
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
  accentHex,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  accentHex?: string;
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
          'mt-1 truncate text-2xl font-bold tracking-tight',
          highlight ? 'text-emerald-600' : 'text-zinc-900',
        )}
        style={accentHex ? { color: accentHex } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function ResultCard({
  row,
  onDelete,
}: {
  row: Row;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const top = TYPES[row.top_type];
  const sub = TYPES[row.sub_type];
  const sheet = SHEETS[row.top_type];

  return (
    <li className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="-my-1 flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-left transition hover:bg-zinc-50"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900">
              {row.name ?? '(이름 없음)'}
              <span className="ml-2 font-normal text-zinc-500">
                {[row.school, row.grade].filter(Boolean).join(' / ') ||
                  '학교 미상'}
              </span>
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              {row.phone ?? '연락처 없음'} · {fmtTs(row.created_at)}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: top?.hex ?? '#71717a' }}
          >
            {top ? top.name : `유형 ${row.top_type}`}
          </span>
        </button>
        <KebabMenu onDelete={() => onDelete(row.id)} />
      </div>

      {open && (
        <div className="border-t border-zinc-100 px-4 py-4">
          <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="space-y-1.5">
              {TYPE_IDS.map((t) => {
                const score = row.scores?.[String(t)] ?? 0;
                const pct = Math.max(0, Math.min(100, (score / MAX_SCORE) * 100));
                const type = TYPES[t];
                const isTop = t === row.top_type;
                const isSub = t === row.sub_type;
                return (
                  <div key={t} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'w-16 shrink-0 text-right text-xs',
                        isTop
                          ? 'font-bold text-zinc-900'
                          : isSub
                            ? 'font-semibold text-zinc-700'
                            : 'text-zinc-500',
                      )}
                    >
                      {type.name}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: type.hex }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-zinc-600">
                      {score}
                    </span>
                  </div>
                );
              })}
            </div>
            <RadarChart scores={row.scores} />
          </div>

          <div className="mt-4 rounded-lg bg-zinc-50 p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-zinc-500">주요기질</span>
              <span
                className="font-bold"
                style={{ color: top?.hex ?? undefined }}
              >
                {top ? `${top.name} · ${top.tag}` : `유형 ${row.top_type}`}
              </span>
              <span className="text-zinc-500">서브기질</span>
              <span
                className="font-semibold"
                style={{ color: sub?.hex ?? undefined }}
              >
                {sub ? sub.name : `유형 ${row.sub_type}`}
              </span>
            </div>
            {sheet?.summary && (
              <p className="mt-2 text-sm text-zinc-700">{sheet.summary}</p>
            )}
            {sheet?.body &&
              sheet.body
                .split('\n\n')
                .map((para, i) => (
                  <p key={i} className="mt-2 text-sm leading-relaxed text-zinc-600">
                    {para}
                  </p>
                ))}
          </div>

          <AnswerDetail row={row} />

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => onDelete(row.id)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />이 결과 삭제
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** 카드 우측 "⋯" 메뉴 — 운영자가 결과를 바로 삭제할 수 있다. */
function KebabMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="더보기"
        className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-10 w-32 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> 삭제
          </button>
        </div>
      )}
    </div>
  );
}

/** "문항별 응답" 접이식 — 영역 A~I 순서로 학생이 고른 값과 라벨을 보여준다. */
function AnswerDetail({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-zinc-50 px-3 py-2 text-left transition hover:bg-zinc-100"
      >
        <span className="flex-1 text-sm font-semibold text-zinc-800">
          문항별 응답
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-zinc-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="space-y-4 border-t border-zinc-100 px-3 py-3">
          {TYPE_IDS.map((t) => {
            const label = AREA[t - 1];
            const info = TYPES[t];
            const qs = QUESTIONS[t] ?? [];
            const ans = row.answers?.[String(t)] ?? [];
            return (
              <div key={t}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: info.hex }}
                  />
                  <h4 className="text-xs font-bold text-zinc-700">
                    영역 {label} · {info.name}
                  </h4>
                </div>
                <ul className="space-y-1">
                  {qs.map((q, idx) => {
                    const v = ans[idx] ?? 0;
                    const answered = v >= 1 && v <= 5;
                    const label5 = answered
                      ? SCALE[v - 1].replace(/\n/g, ' ')
                      : '—';
                    return (
                      <li
                        key={idx}
                        className="flex items-baseline gap-2 text-xs"
                      >
                        <span className="w-5 shrink-0 text-right font-mono text-zinc-400">
                          {idx + 1}
                        </span>
                        <span className="flex-1 text-zinc-600">{q}</span>
                        <span
                          className={cn(
                            'shrink-0 rounded px-1.5 py-0.5 font-medium tabular-nums',
                            !answered
                              ? 'text-zinc-400'
                              : v >= 4
                                ? 'bg-emerald-50 text-emerald-700'
                                : v <= 2
                                  ? 'bg-zinc-100 text-zinc-500'
                                  : 'text-zinc-600',
                          )}
                        >
                          {answered ? `${v} ${label5}` : '—'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 9축 원형 레이더 차트 (SVG). 점수 15~75 → 반지름 비율. */
function RadarChart({ scores }: { scores: Row['scores'] }) {
  const size = 176;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 24;

  const point = (t: number, ratio: number) => {
    // 유형 1을 12시 방향에 두고 시계방향 배치
    const angle = (-90 + (t - 1) * 40) * (Math.PI / 180);
    const r = maxR * ratio;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  const dataPts = TYPE_IDS.map((t) => {
    const score = scores?.[String(t)] ?? 0;
    const ratio = Math.max(0, Math.min(1, score / MAX_SCORE));
    return point(t, ratio);
  });
  const dataPath =
    dataPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + 'Z';

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto h-44 w-44 shrink-0"
      role="img"
      aria-label="유형별 점수 레이더 차트"
    >
      {rings.map((ratio) => {
        const pts = TYPE_IDS.map((t) => point(t, ratio));
        const d =
          pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') +
          'Z';
        return (
          <path key={ratio} d={d} fill="none" stroke="#e4e4e7" strokeWidth={1} />
        );
      })}
      {TYPE_IDS.map((t) => {
        const [x, y] = point(t, 1);
        return (
          <line
            key={t}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="#f4f4f5"
            strokeWidth={1}
          />
        );
      })}
      <path
        d={dataPath}
        fill="rgba(99,102,241,0.18)"
        stroke="#6366f1"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {TYPE_IDS.map((t) => {
        const [lx, ly] = point(t, 1.14);
        return (
          <text
            key={t}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fill="#a1a1aa"
          >
            {t}
          </text>
        );
      })}
    </svg>
  );
}
