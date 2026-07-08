'use client';

import { Search } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { TYPES } from '@/entities/enneagram';

export type EnneaDateRange = 'all' | '24h' | '7d' | '30d';
export type EnneaSortKey = 'created_desc' | 'name_asc' | 'total_desc';
/** 'all' 또는 주요기질 유형 1~9 */
export type TopTypeFilter = 'all' | number;

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  range: EnneaDateRange;
  onRangeChange: (r: EnneaDateRange) => void;
  sort: EnneaSortKey;
  onSortChange: (s: EnneaSortKey) => void;
  topType: TopTypeFilter;
  onTopTypeChange: (t: TopTypeFilter) => void;
};

const rangeOptions: { value: EnneaDateRange; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: '24h', label: '24시간' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
];

const sortOptions: { value: EnneaSortKey; label: string }[] = [
  { value: 'created_desc', label: '최신순' },
  { value: 'name_asc', label: '이름순' },
  { value: 'total_desc', label: '총점 높은순' },
];

const TYPE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function PillGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white p-0.5 shadow-sm"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'h-7 rounded-md px-2.5 text-xs font-medium transition',
              active
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function EnneaFilterBar(props: Props) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <PillGroup
          ariaLabel="기간"
          options={rangeOptions}
          value={props.range}
          onChange={props.onRangeChange}
        />
        <select
          aria-label="정렬"
          value={props.sort}
          onChange={(e) => props.onSortChange(e.target.value as EnneaSortKey)}
          className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          aria-label="주요기질"
          value={props.topType === 'all' ? 'all' : String(props.topType)}
          onChange={(e) =>
            props.onTopTypeChange(
              e.target.value === 'all' ? 'all' : Number(e.target.value),
            )
          }
          className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
        >
          <option value="all">주요기질 전체</option>
          {TYPE_IDS.map((t) => (
            <option key={t} value={t}>
              {TYPES[t].name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 shadow-sm focus-within:ring-2 focus-within:ring-zinc-300">
        <Search className="h-4 w-4 text-zinc-400" />
        <input
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
          placeholder="이름 · 학교 · 전화번호 검색"
          className="h-10 w-full border-0 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
        />
      </div>
    </div>
  );
}
