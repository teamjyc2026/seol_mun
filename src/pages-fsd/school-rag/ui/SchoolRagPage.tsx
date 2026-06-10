'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Save, School as SchoolIcon, Trash2 } from 'lucide-react';
import type { School } from '@/entities/school';
import { cn } from '@/shared/lib/cn';

export type SchoolSourceRow = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  source_type: string | null;
  indexing_status: string;
  school_id: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  ready: '준비됨',
  pending: '대기',
  processing: '처리 중',
  failed: '실패',
  needs_ocr: 'OCR 필요',
};

export function SchoolRagPage({
  initialSchools,
  initialSources,
}: {
  initialSchools: School[];
  initialSources: SchoolSourceRow[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSchools[0]?.id ?? null,
  );
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  // Source-id set assigned to the selected school (local edits before save).
  const [assigned, setAssigned] = useState<Set<string>>(
    () =>
      new Set(
        initialSources
          .filter((s) => s.school_id && s.school_id === (initialSchools[0]?.id ?? null))
          .map((s) => s.id),
      ),
  );

  const selected = initialSchools.find((s) => s.id === selectedId) ?? null;

  function pickSchool(id: string) {
    setSelectedId(id);
    setAssigned(
      new Set(initialSources.filter((s) => s.school_id === id).map((s) => s.id)),
    );
  }

  const sortedSources = useMemo(
    () =>
      [...initialSources].sort((a, b) => {
        const ra = a.indexing_status === 'ready' ? 0 : 1;
        const rb = b.indexing_status === 'ready' ? 0 : 1;
        return ra - rb;
      }),
    [initialSources],
  );

  async function createSchool() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/agent/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? '생성 실패');
      }
      toast.success(`'${name}' 학교를 만들었어요.`);
      setNewName('');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '생성 실패');
    } finally {
      setCreating(false);
    }
  }

  async function saveAssignment() {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/agent/schools/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceIds: Array.from(assigned) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? '저장 실패');
      }
      toast.success(`'${selected.name}'에 자료 ${assigned.size}개를 배정했어요.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSchool() {
    if (!selected) return;
    if (!confirm(`'${selected.name}' 학교를 삭제할까요? (자료는 배정만 해제됩니다)`)) return;
    try {
      const res = await fetch(`/api/agent/schools/${selected.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('삭제 실패');
      toast.success('삭제했어요.');
      setSelectedId(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '삭제 실패');
    }
  }

  function toggle(id: string) {
    setAssigned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center gap-2">
        <SchoolIcon className="h-5 w-5 text-zinc-700" />
        <h1 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
          학교별 RAG
        </h1>
        <p className="ml-2 text-xs text-zinc-500">
          학교를 만들고 임베딩된 자료를 배정하면, 채팅에서 그 학교 자료 기반 에이전트로 동작합니다.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        {/* School list + create */}
        <section className="space-y-2">
          <div className="flex gap-1.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createSchool()}
              placeholder="학교 이름 (예: 서울예고)"
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
            />
            <button
              type="button"
              onClick={createSchool}
              disabled={creating || !newName.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> 추가
            </button>
          </div>
          <div className="space-y-1">
            {initialSchools.length === 0 && (
              <p className="rounded-lg border border-dashed border-zinc-200 bg-white p-3 text-xs text-zinc-500">
                아직 학교가 없어요. 먼저 학교를 추가하세요.
              </p>
            )}
            {initialSchools.map((s) => {
              const count = initialSources.filter((x) => x.school_id === s.id).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSchool(s.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition',
                    s.id === selectedId
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                  )}
                >
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-zinc-500">{count}개</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Source assignment */}
        <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
          {!selected ? (
            <p className="p-4 text-sm text-zinc-500">왼쪽에서 학교를 선택하세요.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">
                  {selected.name} — 자료 배정 ({assigned.size}개 선택)
                </h2>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={saveAssignment}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                  >
                    <Save className="h-3.5 w-3.5" /> 저장
                  </button>
                  <button
                    type="button"
                    onClick={deleteSchool}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> 학교 삭제
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-zinc-100">
                {sortedSources.map((src) => {
                  const ready = src.indexing_status === 'ready';
                  const checked = assigned.has(src.id);
                  const assignedElsewhere =
                    !!src.school_id && src.school_id !== selected.id;
                  return (
                    <li key={src.id}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2.5 px-1 py-2',
                          !ready && 'opacity-50',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(src.id)}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">
                          {src.title}
                        </span>
                        {assignedElsewhere && (
                          <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                            다른 학교 배정됨
                          </span>
                        )}
                        <span className="shrink-0 text-xs text-zinc-500">
                          {[src.subject, src.grade, src.source_type].filter(Boolean).join(' · ')}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 rounded px-1.5 py-0.5 text-[10px]',
                            ready
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-zinc-100 text-zinc-500',
                          )}
                        >
                          {STATUS_LABEL[src.indexing_status] ?? src.indexing_status}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
