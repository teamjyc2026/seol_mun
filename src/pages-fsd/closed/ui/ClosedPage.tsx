import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export function ClosedPage() {
  return (
    <main className="min-h-svh bg-gradient-to-b from-zinc-50 via-white to-rose-50">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 px-6 py-24 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-zinc-900 text-white shadow-lg">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            설문 모집이 마감되었습니다
          </h1>
          <p className="text-base leading-relaxed text-zinc-600 sm:text-lg">
            많은 관심과 참여에 진심으로 감사드립니다.
            <br />
            다음 기회에 더 좋은 모습으로 다시 만나뵐게요.
          </p>
        </div>
        <p className="text-xs text-zinc-400">
          상품권은 응답하신 분들께 입력해 주신 연락처로 순차 발송됩니다.
        </p>

        <div className="mt-4 w-full max-w-sm space-y-2">
          <Link
            href="/student"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
          >
            학생 로그인 · 공부 시작하기
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-xs text-zinc-400">
            AI 학습 튜터를 이용하려면 학생 계정으로 로그인하세요.
          </p>
        </div>

        <footer className="mt-8 border-t border-zinc-200/60 pt-4">
          <Link
            href="/admin/login?as=uploader"
            className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline"
          >
            선생님 로그인
          </Link>
        </footer>
      </div>
    </main>
  );
}
