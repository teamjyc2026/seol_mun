'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/shared/lib/cn';

export type DateRange = '24h' | '7d' | '30d' | 'all';
export type StatusFilter = 'all' | 'submitted' | 'draft';
export type SortKey = 'created_desc' | 'created_asc' | 'name_asc';

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
  status: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
};

const rangeOptions: { value: DateRange; label: string }[] = [
  { value: '24h', label: '24시간' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: 'all', label: '전체' },
];

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'submitted', label: '제출' },
  { value: 'draft', label: '임시저장' },
];

const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'created_desc', label: '최신순' },
  { value: 'created_asc', label: '오래된순' },
  { value: 'name_asc', label: '이름순' },
];

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

export function FilterBar(props: Props) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <PillGroup
          ariaLabel="기간"
          options={rangeOptions}
          value={props.range}
          onChange={props.onRangeChange}
        />
        <PillGroup
          ariaLabel="상태"
          options={statusOptions}
          value={props.status}
          onChange={props.onStatusChange}
        />
        <select
          aria-label="정렬"
          value={props.sort}
          onChange={(e) => props.onSortChange(e.target.value as SortKey)}
          className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 shadow-sm focus-within:ring-2 focus-within:ring-zinc-300">
        <Search className="h-4 w-4 text-zinc-400" />
        <Input
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
          placeholder="이름·이메일·연락처·소속으로 검색"
          className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}
