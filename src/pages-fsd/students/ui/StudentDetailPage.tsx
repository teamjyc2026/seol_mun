'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  GraduationCap,
  Loader2,
  MessageSquare,
  Target,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { StudentRecord } from '@/entities/student/server';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/lib/formatDate';
import { stripRichText } from '@/shared/lib/richText';

type Msg = { id: string; role: string; content: { text?: string } | null; created_at: string };

const DIFF_LABEL: Record<string, string> = { easy: '쉬움', medium: '보통', hard: '어려움' };

export function StudentDetailPage({ record }: { record: StudentRecord }) {
  const { student, attempts, levels, weaknesses, rooms } = record;
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const [msgsByRoom, setMsgsByRoom] = useState<Record<string, Msg[]>>({});
  const [loadingRoom, setLoadingRoom] = useState<string | null>(null);

  const total = attempts.length;
  const correct = attempts.filter((a) => a.is_correct).length;
  const accuracy = total ? Math.round((correct / total) * 100) : null;

  async function toggleRoom(id: string) {
    if (openRoom === id) {
      setOpenRoom(null);
      return;
    }
    setOpenRoom(id);
    if (!msgsByRoom[id]) {
      setLoadingRoom(id);
      try {
        const res = await fetch(`/api/agent/conversations/${id}`);
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '조회 실패');
        const data = (await res.json()) as { messages: Msg[] };
        setMsgsByRoom((prev) => ({ ...prev, [id]: data.messages ?? [] }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '대화 조회 실패');
        setOpenRoom(null);
      } finally {
        setLoadingRoom(null);
      }
    }
  }

  if (!student) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link
          href="/admin/agent/students"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> 학생 목록
        </Link>
        <p className="mt-8 text-center text-sm text-zinc-500">학생을 찾을 수 없어요.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/admin/agent/students"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft className="h-4 w-4" /> 학생 목록
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet-100 text-base font-bold text-violet-700">
          {student.name.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="text-lg font-bold text-zinc-900">{student.name}</h1>
            {student.grade ? (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                <GraduationCap className="h-2.5 w-2.5" />
                {student.grade}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-zinc-500">
            {student.email} · 가입 {formatDate(student.created_at)}
          </p>
        </div>
        <div className="ml-auto text-right">
          <div
            className={cn(
              'text-xl font-bold',
              accuracy === null
                ? 'text-zinc-400'
                : accuracy >= 70
                  ? 'text-emerald-600'
                  : accuracy >= 40
                    ? 'text-amber-600'
                    : 'text-rose-600',
            )}
          >
            {accuracy === null ? '–' : `${accuracy}%`}
          </div>
          <div className="text-[10px] text-zinc-400">
            정답 {correct}/{total}
          </div>
        </div>
      </header>

      {/* 약점 (level + weakness 메모) */}
      {(levels.length > 0 || weaknesses.length > 0) && (
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
            <Target className="h-4 w-4 text-rose-500" /> 약점·수준
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {levels.map((l, i) => (
              <span
                key={`${l.subject}-${l.topic}-${i}`}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600"
              >
                {l.subject}
                {l.topic ? ` · ${l.topic}` : ''}
                <span
                  className={cn(
                    'font-bold',
                    l.score >= 0.7
                      ? 'text-emerald-600'
                      : l.score >= 0.4
                        ? 'text-amber-600'
                        : 'text-rose-600',
                  )}
                >
                  {Math.round(l.score * 100)}%
                </span>
              </span>
            ))}
          </div>
          {weaknesses.length > 0 && (
            <ul className="mt-2 space-y-1">
              {weaknesses.map((w, i) => (
                <li key={i} className="text-[12px] text-zinc-600">
                  • {w.content}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 정오답 결과 */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-zinc-800">정오답 기록 ({total})</h2>
        {total === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
            아직 푼 문제가 없어요.
          </div>
        ) : (
          <ul className="space-y-2">
            {attempts.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white',
                      a.is_correct ? 'bg-emerald-500' : 'bg-rose-500',
                    )}
                  >
                    {a.is_correct ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13px] text-zinc-800">
                      {a.problem ? stripRichText(a.problem.question) : '(삭제된 문제)'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-zinc-400">
                      {a.problem?.subject ? (
                        <span className="rounded bg-violet-50 px-1.5 py-0.5 font-medium text-violet-700">
                          {a.problem.subject}
                        </span>
                      ) : null}
                      {a.problem?.topic ? (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-700">
                          {a.problem.topic}
                        </span>
                      ) : null}
                      {a.problem?.difficulty ? (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                          {DIFF_LABEL[a.problem.difficulty] ?? a.problem.difficulty}
                        </span>
                      ) : null}
                      {a.score !== null ? <span>점수 {Math.round(a.score * 100)}</span> : null}
                      <span className="ml-auto">{formatDate(a.created_at)}</span>
                    </div>
                    {a.student_answer ? (
                      <p className="mt-1 text-[11px] text-zinc-500">
                        학생 답: <span className="text-zinc-700">{a.student_answer}</span>
                      </p>
                    ) : null}
                    {a.feedback ? (
                      <p className="mt-0.5 text-[11px] text-zinc-500">{a.feedback}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 채팅(방) */}
      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <MessageSquare className="h-4 w-4 text-zinc-500" /> 물어본 대화 ({rooms.length})
        </h2>
        {rooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
            대화 기록이 없어요.
          </div>
        ) : (
          <ul className="space-y-2">
            {rooms.map((r) => {
              const open = openRoom === r.id;
              const msgs = msgsByRoom[r.id];
              return (
                <li key={r.id} className="rounded-xl border border-zinc-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => void toggleRoom(r.id)}
                    className="flex w-full items-start gap-2 p-3 text-left"
                  >
                    <ChevronRight
                      className={cn('mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition', open && 'rotate-90')}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-zinc-800">
                        {r.title || '(제목 없음)'}
                      </p>
                      {r.summary ? (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">{r.summary}</p>
                      ) : null}
                      <div className="mt-1 text-[10px] text-zinc-400">
                        {formatDate(r.created_at)} · 메시지 {r.messages}개
                      </div>
                    </div>
                  </button>
                  {open && (
                    <div className="border-t border-zinc-100 px-3 py-2">
                      {loadingRoom === r.id && !msgs ? (
                        <div className="grid h-16 place-items-center">
                          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                        </div>
                      ) : msgs && msgs.length > 0 ? (
                        <ul className="space-y-1.5">
                          {msgs.map((m) => (
                            <li key={m.id} className="flex gap-2 text-[12px]">
                              <span
                                className={cn(
                                  'shrink-0 font-semibold',
                                  m.role === 'user' ? 'text-violet-600' : 'text-zinc-500',
                                )}
                              >
                                {m.role === 'user' ? '학생' : '도우미'}
                              </span>
                              <span className="min-w-0 whitespace-pre-wrap break-words text-zinc-700">
                                {m.content?.text || '(내용 없음)'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="py-2 text-center text-[11px] text-zinc-400">메시지가 없어요.</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
