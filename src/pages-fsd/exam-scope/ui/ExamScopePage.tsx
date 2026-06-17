'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, ClipboardList, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { SUBJECTS } from '@/shared/config/subjects';
import { cn } from '@/shared/lib/cn';
import { useMergeState } from '@/shared/lib/mergeReducer';

const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];

type SchoolRow = { id: string; name: string; grade: string | null; year: number | null };
type ScopeRow = {
  id: string;
  name: string;
  subject: string | null;
  grade: string | null;
  sourceCount: number;
};
type WbSource = { id: string; title: string; subject: string | null; grade: string | null };
type ProblemLite = { id: string; question: string; problem_type: string | null };

type State = {
  schools: SchoolRow[];
  schoolId: string | null;
  scopes: ScopeRow[];
  scopeId: string | null;
  wbSources: WbSource[];
  /** 청크(본문/개념)를 담는 소스 집합. */
  assignedSources: Set<string>;
  /** 범위에 담긴 문제 집합(문제 단위 선택). */
  assignedProblems: Set<string>;
  /** 소스별 문제 목록(지연 로드). */
  problemsBySource: Record<string, ProblemLite[]>;
  expanded: Set<string>;
  loadingSource: string | null;
  loadingSchools: boolean;
  loadingScopes: boolean;
  loadingSources: boolean;
  saving: boolean;
  // 폼
  newSchool: string;
  newSchoolYear: string;
  newScopeName: string;
  newScopeSubject: string;
  newScopeGrade: string;
};

const INITIAL: State = {
  schools: [],
  schoolId: null,
  scopes: [],
  scopeId: null,
  wbSources: [],
  assignedSources: new Set(),
  assignedProblems: new Set(),
  problemsBySource: {},
  expanded: new Set(),
  loadingSource: null,
  loadingSchools: true,
  loadingScopes: false,
  loadingSources: false,
  saving: false,
  newSchool: '',
  newSchoolYear: '',
  newScopeName: '',
  newScopeSubject: '',
  newScopeGrade: '',
};

/** 로딩 중 자리를 잡아 레이아웃 시프트를 막는 시머 스켈레톤. */
function Shimmer({ count, className }: { count: number; className?: string }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn('animate-pulse rounded-lg bg-zinc-100', className ?? 'h-10')}
        />
      ))}
    </>
  );
}

export function ExamScopePage() {
  const [s, set] = useMergeState<State>(INITIAL);

  useEffect(() => {
    void loadSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSchools() {
    set({ loadingSchools: true });
    try {
      const res = await fetch('/api/agent/schools');
      const data = (await res.json()) as { schools: SchoolRow[] };
      set({ schools: data.schools ?? [] });
    } catch {
      toast.error('학교 목록을 불러오지 못했어요.');
    } finally {
      set({ loadingSchools: false });
    }
  }

  async function pickSchool(id: string) {
    set({
      schoolId: id,
      scopeId: null,
      assignedSources: new Set(),
      assignedProblems: new Set(),
      wbSources: [],
      expanded: new Set(),
      problemsBySource: {},
      loadingScopes: true,
    });
    try {
      const res = await fetch(`/api/agent/schools/${id}/scopes`);
      const data = (await res.json()) as { scopes: ScopeRow[] };
      set({ scopes: data.scopes ?? [] });
    } catch {
      toast.error('시험범위를 불러오지 못했어요.');
    } finally {
      set({ loadingScopes: false });
    }
  }

  async function createSchool() {
    const name = s.newSchool.trim();
    if (!name) return;
    const year = s.newSchoolYear.trim() ? Number(s.newSchoolYear.trim()) : null;
    try {
      const res = await fetch('/api/agent/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, year }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '생성 실패');
      set({ newSchool: '', newSchoolYear: '' });
      await loadSchools();
      toast.success(`'${name}' 학교를 만들었어요.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '생성 실패');
    }
  }

  async function pickScope(sc: ScopeRow) {
    set({ scopeId: sc.id, expanded: new Set(), problemsBySource: {}, loadingSources: true });
    try {
      const [detailRes, srcRes] = await Promise.all([
        fetch(`/api/agent/scopes/${sc.id}`),
        fetch(
          `/api/agent/workbench/sources${sc.subject ? `?subject=${encodeURIComponent(sc.subject)}` : ''}`,
        ),
      ]);
      const detail = (await detailRes.json()) as { sourceIds: string[]; problemIds?: string[] };
      const src = (await srcRes.json()) as { sources: WbSource[] };
      set({
        assignedSources: new Set(detail.sourceIds ?? []),
        assignedProblems: new Set(detail.problemIds ?? []),
        wbSources: src.sources ?? [],
      });
    } catch {
      toast.error('범위 상세를 불러오지 못했어요.');
    } finally {
      set({ loadingSources: false });
    }
  }

  async function createScope() {
    if (!s.schoolId) return;
    const name = s.newScopeName.trim();
    if (!name) return;
    try {
      const res = await fetch(`/api/agent/schools/${s.schoolId}/scopes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject: s.newScopeSubject || undefined,
          grade: s.newScopeGrade || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '생성 실패');
      const { scope } = (await res.json()) as { scope: ScopeRow };
      set({ newScopeName: '', scopes: [...s.scopes, scope] });
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
      set({ scopes: s.scopes.filter((x) => x.id !== sc.id) });
      if (s.scopeId === sc.id) {
        set({ scopeId: null, assignedSources: new Set(), assignedProblems: new Set() });
      }
    } catch {
      toast.error('삭제 실패');
    }
  }

  async function saveSources() {
    if (!s.scopeId || s.saving) return;
    set({ saving: true });
    try {
      const res = await fetch(`/api/agent/scopes/${s.scopeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceIds: Array.from(s.assignedSources),
          problemIds: Array.from(s.assignedProblems),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '저장 실패');
      set({
        scopes: s.scopes.map((x) =>
          x.id === s.scopeId ? { ...x, sourceCount: s.assignedSources.size } : x,
        ),
      });
      toast.success(`자료 ${s.assignedSources.size}개 · 문제 ${s.assignedProblems.size}개를 담았어요.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 실패');
    } finally {
      set({ saving: false });
    }
  }

  /** 소스의 문제 목록을 가져온다(이미 있으면 그대로). */
  async function ensureProblems(sourceId: string): Promise<ProblemLite[]> {
    if (s.problemsBySource[sourceId]) return s.problemsBySource[sourceId];
    set({ loadingSource: sourceId });
    try {
      const res = await fetch(`/api/agent/problems?sourceId=${encodeURIComponent(sourceId)}`);
      const data = (await res.json()) as { problems: ProblemLite[] };
      const list = (data.problems ?? []).map((p) => ({
        id: p.id,
        question: p.question,
        problem_type: p.problem_type,
      }));
      set({ problemsBySource: { ...s.problemsBySource, [sourceId]: list } });
      return list;
    } catch {
      toast.error('문제 목록을 불러오지 못했어요.');
      return [];
    } finally {
      set({ loadingSource: null });
    }
  }

  async function toggleExpand(sourceId: string) {
    const next = new Set(s.expanded);
    if (next.has(sourceId)) next.delete(sourceId);
    else {
      next.add(sourceId);
      void ensureProblems(sourceId);
    }
    set({ expanded: next });
  }

  /** 소스 마스터 토글 — 청크 포함 + 그 소스의 모든 문제를 일괄 포함/제외. */
  async function toggleSource(sourceId: string) {
    const on = !s.assignedSources.has(sourceId);
    const list = await ensureProblems(sourceId);
    const nextSources = new Set(s.assignedSources);
    const nextProblems = new Set(s.assignedProblems);
    if (on) {
      nextSources.add(sourceId);
      list.forEach((p) => nextProblems.add(p.id));
    } else {
      nextSources.delete(sourceId);
      list.forEach((p) => nextProblems.delete(p.id));
    }
    set({ assignedSources: nextSources, assignedProblems: nextProblems });
  }

  function toggleProblem(id: string) {
    const next = new Set(s.assignedProblems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ assignedProblems: next });
  }

  const selectedScope = s.scopes.find((x) => x.id === s.scopeId) ?? null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-zinc-700" />
        <h1 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
          학교 시험범위
        </h1>
        <p className="ml-2 text-xs text-zinc-500">
          학교마다 시험범위를 만들고 워크벤치 자료(또는 그 안의 문제)를 담으면, 채팅이 그 범위로 동작해요.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[220px_240px_1fr]">
        {/* 1) 학교 */}
        <section className="space-y-2">
          <div className="space-y-1.5">
            <input
              value={s.newSchool}
              onChange={(e) => set({ newSchool: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && createSchool()}
              placeholder="학교 이름"
              className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
            />
            <div className="flex gap-1.5">
              <input
                value={s.newSchoolYear}
                onChange={(e) => set({ newSchoolYear: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                onKeyDown={(e) => e.key === 'Enter' && createSchool()}
                inputMode="numeric"
                placeholder="년도 (예: 2026)"
                className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
              />
              <button
                type="button"
                onClick={createSchool}
                disabled={!s.newSchool.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {s.loadingSchools && <Shimmer count={3} />}
            {!s.loadingSchools && s.schools.length === 0 && (
              <p className="rounded-lg border border-dashed border-zinc-200 bg-white p-3 text-xs text-zinc-500">
                먼저 학교를 추가하세요.
              </p>
            )}
            {!s.loadingSchools &&
              s.schools.map((sch) => (
              <button
                key={sch.id}
                type="button"
                onClick={() => void pickSchool(sch.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition',
                  sch.id === s.schoolId
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                )}
              >
                <span className="truncate font-medium">{sch.name}</span>
                {sch.year != null && (
                  <span className="ml-2 shrink-0 text-xs text-zinc-400">{sch.year}</span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* 2) 시험범위 */}
        <section className="space-y-2">
          {!s.schoolId ? (
            <p className="rounded-lg border border-dashed border-zinc-200 bg-white p-3 text-xs text-zinc-500">
              학교를 선택하세요.
            </p>
          ) : (
            <>
              <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-white p-2.5">
                <input
                  value={s.newScopeName}
                  onChange={(e) => set({ newScopeName: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && createScope()}
                  placeholder="범위 이름 (예: 1학기 중간)"
                  className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
                />
                <div className="flex gap-1.5">
                  <select
                    value={s.newScopeSubject}
                    onChange={(e) => set({ newScopeSubject: e.target.value })}
                    className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-1 text-xs"
                  >
                    <option value="">과목(전체)</option>
                    {SUBJECTS.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                  <select
                    value={s.newScopeGrade}
                    onChange={(e) => set({ newScopeGrade: e.target.value })}
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
                    disabled={!s.newScopeName.trim()}
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 text-xs font-medium text-white disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {s.loadingScopes && <Shimmer count={2} className="h-12" />}
                {!s.loadingScopes && s.scopes.length === 0 && (
                  <p className="px-1 text-xs text-zinc-400">아직 범위가 없어요.</p>
                )}
                {!s.loadingScopes &&
                  s.scopes.map((sc) => (
                  <div
                    key={sc.id}
                    className={cn(
                      'flex items-center gap-1 rounded-lg border px-2.5 py-2 text-sm transition',
                      sc.id === s.scopeId
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

        {/* 3) 워크벤치 소스/문제 피커 */}
        <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
          {!selectedScope ? (
            <p className="p-4 text-sm text-zinc-500">범위를 선택하면 워크벤치 자료를 담을 수 있어요.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">
                  {selectedScope.name} — 자료 {s.assignedSources.size} · 문제 {s.assignedProblems.size}
                </h2>
                <button
                  type="button"
                  onClick={saveSources}
                  disabled={s.saving}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  {s.saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}{' '}
                  저장
                </button>
              </div>
              <p className="mb-2 text-[11px] text-zinc-400">
                자료를 펼쳐 개별 문제를 고를 수 있어요. 자료 체크는 본문/개념 + 그 자료의 모든 문제를 담아요.
              </p>
              {s.loadingSources ? (
                <div className="space-y-1.5 p-1">
                  <Shimmer count={5} />
                </div>
              ) : s.wbSources.length === 0 ? (
                <p className="p-4 text-sm text-zinc-500">
                  {selectedScope.subject
                    ? `'${selectedScope.subject}' 과목의 워크벤치 자료가 없어요.`
                    : '워크벤치로 만든 자료가 없어요.'}
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {s.wbSources.map((src) => {
                    const probs = s.problemsBySource[src.id];
                    const isOpen = s.expanded.has(src.id);
                    const pickedCount = probs
                      ? probs.filter((p) => s.assignedProblems.has(p.id)).length
                      : 0;
                    return (
                      <li key={src.id} className="py-1">
                        <div className="flex items-center gap-2 px-1 py-1">
                          <input
                            type="checkbox"
                            checked={s.assignedSources.has(src.id)}
                            onChange={() => void toggleSource(src.id)}
                            className="h-4 w-4 accent-indigo-600"
                            title="이 자료 전체(본문/개념 + 모든 문제)"
                          />
                          <button
                            type="button"
                            onClick={() => void toggleExpand(src.id)}
                            className="flex min-w-0 flex-1 items-center gap-1 text-left"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                            )}
                            <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">
                              {src.title}
                            </span>
                            {probs && (
                              <span className="shrink-0 text-[11px] text-zinc-400">
                                문제 {pickedCount}/{probs.length}
                              </span>
                            )}
                          </button>
                          <span className="shrink-0 text-xs text-zinc-400">
                            {[src.subject, src.grade].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                        {isOpen && (
                          <div className="ml-7 mt-0.5 space-y-0.5 border-l border-zinc-100 pl-3">
                            {s.loadingSource === src.id && !probs ? (
                              <p className="py-1 text-xs text-zinc-400">
                                <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> 문제 불러오는 중…
                              </p>
                            ) : probs && probs.length === 0 ? (
                              <p className="py-1 text-xs text-zinc-400">이 자료엔 저장된 문제가 없어요.</p>
                            ) : (
                              (probs ?? []).map((p, i) => (
                                <label
                                  key={p.id}
                                  className="flex cursor-pointer items-start gap-2 py-0.5"
                                >
                                  <input
                                    type="checkbox"
                                    checked={s.assignedProblems.has(p.id)}
                                    onChange={() => toggleProblem(p.id)}
                                    className="mt-0.5 h-3.5 w-3.5 accent-indigo-600"
                                  />
                                  <span className="min-w-0 flex-1 text-xs text-zinc-600">
                                    <span className="mr-1 text-zinc-400">{i + 1}.</span>
                                    {p.question.slice(0, 80) || '(발문 없음)'}
                                  </span>
                                </label>
                              ))
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
