'use client';

import Link from 'next/link';
import { GraduationCap, MessageSquare, Users } from 'lucide-react';
import type { StudentStat } from '@/entities/student/server';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/lib/formatDate';

function accuracyTone(acc: number | null): string {
  if (acc === null) return 'text-zinc-400';
  if (acc >= 0.7) return 'text-emerald-600';
  if (acc >= 0.4) return 'text-amber-600';
  return 'text-rose-600';
}

export function StudentsPage({ initialStudents }: { initialStudents: StudentStat[] }) {
  const students = initialStudents;
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-zinc-700" />
        <h1 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">학생 기록</h1>
        <p className="ml-2 text-xs text-zinc-500">
          학생이 푼 정오답과 물어본 대화를 봐요.
        </p>
        <span className="ml-auto text-xs text-zinc-400">총 {students.length}명</span>
      </header>

      {students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
          아직 가입한 학생이 없어요.
        </div>
      ) : (
        <ul className="space-y-2">
          {students.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/agent/students/${s.id}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                  {s.name.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-zinc-900">{s.name}</span>
                    {s.grade ? (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                        <GraduationCap className="h-2.5 w-2.5" />
                        {s.grade}
                      </span>
                    ) : null}
                    {s.school ? (
                      <span className="truncate rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                        {s.school}
                      </span>
                    ) : null}
                    <span className="truncate text-[11px] text-zinc-400">{s.email}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    가입 {formatDate(s.created_at)}
                    {s.lastActivity ? ` · 마지막 활동 ${formatDate(s.lastActivity)}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-right">
                  <div>
                    <div className={cn('text-sm font-bold', accuracyTone(s.accuracy))}>
                      {s.accuracy === null ? '–' : `${Math.round(s.accuracy * 100)}%`}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      정답 {s.correct}/{s.attempts}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {s.rooms}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
