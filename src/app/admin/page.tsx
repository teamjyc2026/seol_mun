import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClipboardList, Sparkles } from 'lucide-react';
import { listResponses } from '@/entities/response/server';
import { listEnneagram } from '@/entities/enneagram/server';
import { isAdmin } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function safeCount(fn: () => Promise<{ length: number }>): Promise<number> {
  try {
    return (await fn()).length;
  } catch {
    return 0;
  }
}

export default async function AdminHubPage() {
  if (!(await isAdmin())) {
    redirect('/admin/login');
  }

  const [tutorCount, enneagramCount] = await Promise.all([
    safeCount(listResponses),
    safeCount(listEnneagram),
  ]);

  return (
    <main className="min-h-svh bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              설문 관리
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              관리할 설문을 선택하세요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/agent"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-100"
            >
              에이전트
            </Link>
            <Link
              href="/admin/login"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
            >
              로그아웃
            </Link>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/admin/tutor"
            className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
          >
            <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-zinc-900 text-white">
              <ClipboardList className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">
              ① 학습 튜터 사전 설문
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              <span className="font-semibold text-zinc-700">{tutorCount}건</span>{' '}
              접수 · 마감
            </p>
            <span className="mt-4 text-sm font-medium text-zinc-500 transition group-hover:text-zinc-900">
              대시보드 열기 →
            </span>
          </Link>

          <Link
            href="/admin/enneagram"
            className="group flex flex-col rounded-2xl border border-violet-200 bg-white p-6 shadow-sm transition hover:border-violet-300 hover:shadow-md"
          >
            <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-violet-600 text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">
              ② 학생 에니어그램 검사
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              <span className="font-semibold text-violet-700">
                {enneagramCount}건
              </span>{' '}
              접수 · 진행중
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              신입생 이벤트로 진행 중인 성격 유형 검사예요.
            </p>
            <span className="mt-4 text-sm font-medium text-violet-500 transition group-hover:text-violet-700">
              결과 열기 →
            </span>
          </Link>
        </section>
      </div>
    </main>
  );
}
