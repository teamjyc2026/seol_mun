'use client';

import Link from 'next/link';
import { ArrowRight, Clock, ShieldCheck, Sparkles } from 'lucide-react';

export function LandingPage() {
  return (
    <main className="min-h-svh bg-gradient-to-b from-indigo-50 via-white to-rose-50">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-10 px-6 py-16 sm:py-24">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" /> AI 학습 튜터 사전 설문
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            중·고등학생의 진짜 공부 경험을
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-rose-500 bg-clip-text text-transparent">
              알려주세요.
            </span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg">
            여러분의 응답은 정답이 아닌 <strong>스스로 답을 찾는 AI 튜터</strong> 서비스를
            만드는 데 큰 도움이 됩니다. 부담 없이 솔직하게 답변해 주세요.
          </p>
        </div>

        <ul className="grid w-full gap-3 sm:grid-cols-3">
          <Info icon={<Clock className="h-4 w-4" />} title="약 7~10분">
            8개 파트 · 39문항
          </Info>
          <Info icon={<ShieldCheck className="h-4 w-4" />} title="익명·암호화">
            응답은 분석 목적 외 사용되지 않습니다.
          </Info>
          <Info icon={<Sparkles className="h-4 w-4" />} title="사은품 발송">
            동의 시 추첨 발송 대상에 포함됩니다.
          </Info>
        </ul>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/survey"
            className="inline-flex h-12 items-center justify-center gap-1 rounded-lg bg-zinc-900 px-6 text-base font-medium text-white shadow-lg transition hover:bg-zinc-800"
          >
            설문 시작하기 <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-xs text-zinc-500">
            진행 중 새로고침해도 입력하신 답변은 사라지지 않게 임시 저장됩니다.
          </p>
        </div>

        <footer className="mt-12 w-full border-t border-zinc-200/60 pt-4">
          <Link
            href="/admin"
            className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline"
          >
            관리자
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Info({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white/70 p-4 backdrop-blur">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
        {icon}
        {title}
      </span>
      <span className="text-xs text-zinc-500">{children}</span>
    </li>
  );
}
