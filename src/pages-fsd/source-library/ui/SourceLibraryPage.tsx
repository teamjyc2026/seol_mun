'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import type { Source } from '@/entities/source';
import { UploadDialog } from '@/features/upload-source';
import {
  SourceFilters,
  SourceTable,
  type Filters,
} from '@/widgets/source-table';

const INITIAL: Filters = {
  search: '',
  subject: '',
  source_type: '',
  status: '',
  grade: '',
};

export function SourceLibraryPage({ initialSources }: { initialSources: Source[] }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(INITIAL);

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return initialSources.filter((s) => {
      if (filters.subject && s.subject !== filters.subject) return false;
      if (filters.source_type && s.source_type !== filters.source_type) return false;
      if (filters.status && s.indexing_status !== filters.status) return false;
      if (filters.grade && s.grade !== filters.grade) return false;
      if (term) {
        const hay = [s.title, s.publisher, s.author, s.description, ...(s.units ?? [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [initialSources, filters]);

  const stats = useMemo(() => {
    const total = initialSources.length;
    const ready = initialSources.filter((s) => s.indexing_status === 'ready').length;
    const ocr = initialSources.filter((s) => s.indexing_status === 'needs_ocr').length;
    const failed = initialSources.filter((s) => s.indexing_status === 'failed').length;
    return { total, ready, ocr, failed };
  }, [initialSources]);

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
              📚 교재 업로드
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white shadow-md transition hover:bg-zinc-800"
          >
            <Plus className="h-3.5 w-3.5" />
            소스 업로드
          </button>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="총 소스" value={stats.total} />
          <Stat label="준비됨" value={stats.ready} tone="emerald" />
          <Stat label="OCR 필요" value={stats.ocr} tone="amber" />
          <Stat label="실패" value={stats.failed} tone="rose" />
        </section>

        <SourceFilters filters={filters} onChange={setFilters} />

        <p className="mb-3 text-xs text-zinc-500">
          필터 적용: <span className="font-semibold text-zinc-700">{filtered.length}</span>건
        </p>

        <SourceTable sources={filtered} />
      </div>

      {uploadOpen ? <UploadDialog onClose={() => setUploadOpen(false)} /> : null}
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'emerald' | 'amber' | 'rose';
}) {
  const tones = {
    emerald: 'border-emerald-200 text-emerald-700',
    amber: 'border-amber-200 text-amber-700',
    rose: 'border-rose-200 text-rose-700',
  };
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${tone ? tones[tone] : 'border-zinc-200 text-zinc-900'}`}>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
