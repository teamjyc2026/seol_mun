import { Suspense } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

function Complete({ searchParams }: { searchParams: { id?: string } }) {
  const id = searchParams.id;
  return (
    <main className="min-h-svh bg-gradient-to-b from-emerald-50 via-white to-sky-50">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-6 py-24 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white shadow-lg">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            설문이 제출되었어요. 감사합니다!
          </h1>
          <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
            여러분의 답변은 더 나은 학습 서비스 개발에 큰 도움이 됩니다.
            <br />
            사은품 안내가 필요한 경우 입력해 주신 연락처로 안내드릴게요.
          </p>
        </div>
        {id ? (
          <p className="rounded-md bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-600">
            응답 번호 · {id}
          </p>
        ) : null}
        <Link
          href="/"
          className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
        >
          처음으로
        </Link>
      </div>
    </main>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  return (
    <Suspense fallback={null}>
      <Complete searchParams={params} />
    </Suspense>
  );
}
