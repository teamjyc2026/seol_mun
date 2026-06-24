import { AtSign, GraduationCap, Upload } from 'lucide-react';
import type { AccountRow, AccountsData } from '@/entities/student/server';
import { formatDate } from '@/shared/lib/formatDate';

function AccountList({
  rows,
  emptyText,
}: {
  rows: AccountRow[];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
        {emptyText}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-800">{r.email}</p>
            <p className="truncate text-[11px] text-zinc-400">
              {[r.label || '(이름 없음)', r.school, r.grade].filter(Boolean).join(' · ')} · 가입{' '}
              {formatDate(r.created_at)}
            </p>
          </div>
          {r.bothRoles ? (
            <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              선생님·학생 겹침
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function AccountsPage({ data }: { data: AccountsData }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center gap-2">
        <AtSign className="h-5 w-5 text-zinc-700" />
        <h1 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">계정 이메일</h1>
        <p className="ml-2 text-xs text-zinc-500">등록된 선생님·학생 이메일 목록.</p>
        {data.overlapCount > 0 ? (
          <span className="ml-auto rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
            겹친 이메일 {data.overlapCount}개
          </span>
        ) : null}
      </header>

      <section className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <Upload className="h-4 w-4 text-zinc-500" /> 선생님 ({data.teachers.length})
        </h2>
        <AccountList rows={data.teachers} emptyText="등록된 선생님이 없어요." />
      </section>

      <section className="mt-5 space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <GraduationCap className="h-4 w-4 text-zinc-500" /> 학생 ({data.students.length})
        </h2>
        <AccountList rows={data.students} emptyText="등록된 학생이 없어요." />
      </section>
    </main>
  );
}
