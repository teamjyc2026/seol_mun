'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Plus, Save, Trash2 } from 'lucide-react';
import { SUBJECTS } from '@/shared/config/subjects';
import { cn } from '@/shared/lib/cn';

const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];

type SchoolRow = { id: string; name: string; grade: string | null };
type ScopeRow = {
  id: string;
  name: string;
  subject: string | null;
  grade: string | null;
  sourceCount: number;
};
type WbSource = { id: string; title: string; subject: string | null; grade: string | null };

export function ExamScopePage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [scopes, setScopes] = useState<ScopeRow[]>([]);
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [wbSources, setWbSources] = useState<WbSource[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // 폼
  const [newSchool, setNewSchool] = useState('');
  const [newScopeName, setNewScopeName] = useState('');
  const [newScopeSubject, setNewScopeSubject] = useState<string>('');
  const [newScopeGrade, setNewScopeGrade] = useState<string>('');

  useEffect(() => {
    void loadSchools();
  }, []);

  async function loadSchools() {
    try {
      const res = await fetch('/api/agent/schools');
      const data = (await res.json()) as { schools: SchoolRow[] };
      setSchools(data.schools ?? []);
    } catch {
      toast.error('학교 목록을 불러오지 못했어요.');
    }
  }

  async function pickSchool(id: string) {
    setSchoolId(id);
    setScopeId(null);
    setAssigned(new Set());
    setWbSources([]);
    try {
      const res = await fetch(`/api/agent/schools/${id}/scopes`);
      const data = (await res.json()) as { scopes: ScopeRow[] };
      setScopes(data.scopes ?? []);
    } catch {
      toast.error('시험범위를 불러오지 못했어요.');
    }
  }

  async function createSchool() {
    const name = newSchool.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/agent/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '생성 실패');
      setNewSchool('');
      await loadSchools();
      toast.success(`'${name}' 학교를 만들었어요.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '생성 실패');
    }
  }

  async function pickScope(sc: ScopeRow) {
    setScopeId(sc.id);
    try {
      const [detailRes, srcRes] = await Promise.all([
        fetch(`/api/agent/scopes/${sc.id}`),
        fetch(`/api/agent/workbench/sources${sc.subject ? `?subject=${encodeURIComponent(sc.subject)}` : ''}`),
      ]);
      const detail = (await detailRes.json()) as { sourceIds: string[] };
      const src = (await srcRes.json()) as { sources: WbSource[] };
      setAssigned(new Set(detail.sourceIds ?? []));
      setWbSources(src.sources ?? []);
    } catch {
      toast.error('범위 상세를 불러오지 못했어요.');
    }
  }

  async function createScope() {
    if (!schoolId) return;
    const name = newScopeName.trim();
    if (!name) return;
    try {
      const res = await fetch(`/api/agent/schools/${schoolId}/scopes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject: newScopeSubject || undefined,
          grade: newScopeGrade || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '생성 실패');
      const { scope } = (await res.json()) as { scope: ScopeRow };
      setNewScopeName('');
      setScopes((prev) => [...prev, scope]);
      await pickScope(scope);
      toast.success(`'${name}' 범위를 만들었어요.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '생성 실패');
    }
  }

  async function deleteScope(sc: ScopeRow) {
    if (!confirm(`'${sc.name}' 시험범위를 삭제할까요?`)) return;
    try {
      const res = await fetch(`/api/agent/scopes/${sc.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('삭제 실패');
      setScopes((prev) => prev.filter((x) => x.id !== sc.id));
      if (scopeId === sc.id) {
        setScopeId(null);
        setAssigned(new Set());
        setWbSources([]);
      }
    } catch {
      toast.error('삭제 실패');
    }
  }

  async function saveSources() {
    if (!scopeId || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/agent/scopes/${scopeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceIds: Array.from(assigned) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '저장 실패');
      setScopes((prev) =>
        prev.map((x) => (x.id === scopeId ? { ...x, sourceCount: assigned.size } : x)),
      );
      toast.success(`자료 ${assigned.size}개를 범위에 담았어요.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
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

  const selectedScope = scopes.find((s) => s.id === scopeId) ?? null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-zinc-700" />
        <h1 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
          학교 시험범위
        </h1>
        <p className="ml-2 text-xs text-zinc-500">
          학교마다 시험범위를 만들고 워크벤치로 만든 자료를 담으면, 채팅에서 그 범위 기반으로 동작해요.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[220px_240px_1fr]">
        {/* 1) 학교 */}
        <section className="space-y-2">
          <div className="flex gap-1.5">
            <input
              value={newSchool}
              onChange={(e) => setNewSchool(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createSchool()}
              placeholder="학교 이름"
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
            />
            <button
              type="button"
              onClick={createSchool}
              disabled={!newSchool.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {schools.length === 0 && (
              <p className="rounded-lg border border-dashed border-zinc-200 bg-white p-3 text-xs text-zinc-500">
                먼저 학교를 추가하세요.
              </p>
            )}
            {schools.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void pickSchool(s.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition',
                  s.id === schoolId
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                )}
              >
                <span className="truncate font-medium">{s.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 2) 시험범위 */}
        <section className="space-y-2">
          {!schoolId ? (
            <p className="rounded-lg border border-dashed border-zinc-200 bg-white p-3 text-xs text-zinc-500">
              학교를 선택하세요.
            </p>
          ) : (
            <>
              <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-white p-2.5">
                <input
                  value={newScopeName}
                  onChange={(e) => setNewScopeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createScope()}
                  placeholder="범위 이름 (예: 1학기 중간)"
                  className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
                />
                <div className="flex gap-1.5">
                  <select
                    value={newScopeSubject}
                    onChange={(e) => setNewScopeSubject(e.target.value)}
                    className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-1 text-xs"
                  >
                    <option value="">과목(전체)</option>
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newScopeGrade}
                    onChange={(e) => setNewScopeGrade(e.target.value)}
                    className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-1 text-xs"
                  >
                    <option value="">학년</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={createScope}
                    disabled={!newScopeName.trim()}
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 text-xs font-medium text-white disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {scopes.length === 0 && (
                  <p className="px-1 text-xs text-zinc-400">아직 범위가 없어요.</p>
                )}
                {scopes.map((sc) => (
                  <div
                    key={sc.id}
                    className={cn(
                      'flex items-center gap-1 rounded-lg border px-2.5 py-2 text-sm transition',
                      sc.id === scopeId
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-zinc-200 bg-white hover:bg-zinc-50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void pickScope(sc)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate font-medium text-zinc-800">{sc.name}</span>
                      <span className="text-[11px] text-zinc-500">
                        {[sc.subject, sc.grade].filter(Boolean).join(' · ')}
                        {sc.subject || sc.grade ? ' · ' : ''}자료 {sc.sourceCount}개
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteScope(sc)}
                      className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* 3) 워크벤치 소스 피커 */}
        <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
          {!selectedScope ? (
            <p className="p-4 text-sm text-zinc-500">범위를 선택하면 워크벤치 자료를 담을 수 있어요.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">
                  {selectedScope.name} — 워크벤치 자료 ({assigned.size}개)
                </h2>
                <button
                  type="button"
                  onClick={saveSources}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  <Save className="h-3.5 w-3.5" /> 저장
                </button>
              </div>
              {wbSources.length === 0 ? (
                <p className="p-4 text-sm text-zinc-500">
                  {selectedScope.subject
                    ? `'${selectedScope.subject}' 과목의 워크벤치 자료가 없어요.`
                    : '워크벤치로 만든 자료가 없어요.'}
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {wbSources.map((src) => (
                    <li key={src.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 px-1 py-2">
                        <input
                          type="checkbox"
                          checked={assigned.has(src.id)}
                          onChange={() => toggle(src.id)}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">
                          {src.title}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-500">
                          {[src.subject, src.grade].filter(Boolean).join(' · ')}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
