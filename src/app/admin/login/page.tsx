'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/shared/lib/cn';

export default function AdminLoginPage() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? '비밀번호가 일치하지 않습니다.');
      }
      // Success — keep the button in its busy state until the next page
      // mounts, so it doesn't flicker back to "로그인" between request
      // resolution and navigation.
      startTransition(() => {
        router.replace('/admin');
        router.refresh();
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : '오류가 발생했어요.');
      setLoading(false);
    }
  }

  const busy = loading || isPending;

  return (
    <main className="grid min-h-svh place-items-center bg-zinc-50 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg"
      >
        <div className="space-y-1.5 text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-zinc-900 text-white">
            <Lock className="h-4 w-4" />
          </div>
          <h1 className="text-lg font-bold text-zinc-900">관리자 로그인</h1>
          <p className="text-xs text-zinc-500">대시보드 접근에는 비밀번호가 필요해요.</p>
        </div>
        <div className="space-y-1.5">
          <div className="relative">
            <Input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="비밀번호"
              autoFocus
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? '비밀번호 가리기' : '비밀번호 표시'}
              tabIndex={-1}
              className={cn(
                'absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md',
                'text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700',
              )}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {err ? <p className="text-sm text-rose-600">{err}</p> : null}
        </div>
        <button
          type="submit"
          disabled={busy || pw.length === 0}
          className="h-10 w-full rounded-lg bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy ? '진입 중…' : '로그인'}
        </button>
      </form>
    </main>
  );
}
