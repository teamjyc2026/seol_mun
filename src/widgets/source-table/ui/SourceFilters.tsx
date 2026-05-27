'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  GRADES,
  SOURCE_TYPES,
  type Grade,
  type IndexingStatus,
  type SourceType,
} from '@/entities/source';

export type Filters = {
  search: string;
  subject: string;
  source_type: SourceType | '';
  status: IndexingStatus | '';
  grade: Grade | '';
};

export function SourceFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 shadow-sm focus-within:ring-2 focus-within:ring-zinc-300">
        <Search className="h-4 w-4 text-zinc-400" />
        <Input
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="제목·출판사·저자·메모 검색"
          className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>
      <Select
        value={filters.subject}
        onChange={(v) => set('subject', v)}
        placeholder="(모든 과목)"
        options={['국사', '한국사', '세계사']}
      />
      <Select
        value={filters.source_type}
        onChange={(v) => set('source_type', v as SourceType | '')}
        placeholder="(모든 유형)"
        options={SOURCE_TYPES as unknown as string[]}
      />
      <Select
        value={filters.grade}
        onChange={(v) => set('grade', v as Grade | '')}
        placeholder="(모든 학년)"
        options={GRADES as unknown as string[]}
      />
      <Select
        value={filters.status}
        onChange={(v) => set('status', v as IndexingStatus | '')}
        placeholder="(모든 상태)"
        options={['pending', 'processing', 'ready', 'failed', 'needs_ocr']}
      />
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
