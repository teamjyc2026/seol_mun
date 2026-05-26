'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function AdminLoginPage() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

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
      router.replace('/admin');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }

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
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            autoComplete="current-password"
          />
          {err ? <p className="text-sm text-rose-600">{err}</p> : null}
        </div>
        <button
          type="submit"
          disabled={loading || pw.length === 0}
          className="h-10 w-full rounded-lg bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? '확인 중…' : '로그인'}
        </button>
      </form>
    </main>
  );
}
