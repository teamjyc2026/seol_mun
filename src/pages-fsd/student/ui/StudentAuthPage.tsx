'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/cn';
import { MASCOT_NAME, MascotAvatar } from '@/widgets/student-chat';

export function StudentAuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/student/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'login'
            ? { email, password }
            : { email, password, name, grade: grade || undefined },
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? '실패했어요.');
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '실패했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-gradient-to-b from-orange-50/70 via-white to-white px-4">
      <div className="w-full max-w-sm space-y-4 rounded-3xl border-2 border-zinc-100 bg-white p-6 shadow-lg">
        <div className="flex flex-col items-center gap-2 text-center">
          <MascotAvatar size="xl" />
          <h1 className="text-lg font-extrabold tracking-tight text-zinc-900">
            {MASCOT_NAME}랑 공부 시작! 🦊
          </h1>
          <p className="text-xs text-zinc-500">
            {mode === 'login' ? '다시 왔구나! 반가워 👋' : '가입하고 같이 놀자!'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-zinc-100 p-1 text-sm">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-full py-1.5 font-bold transition',
                mode === m ? 'bg-white text-orange-600 shadow-sm' : 'text-zinc-500',
              )}
            >
              {m === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {mode === 'signup' && (
            <>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름"
                className="w-full rounded-2xl border-2 border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-orange-400"
              />
              <input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="학년 (예: 고1, 선택)"
                className="w-full rounded-2xl border-2 border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-orange-400"
              />
            </>
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            type="email"
            className="w-full rounded-2xl border-2 border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-orange-400"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="비밀번호 (6자 이상)"
            type="password"
            className="w-full rounded-2xl border-2 border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-orange-400"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !email || !password || (mode === 'signup' && !name)}
          className="w-full rounded-full bg-orange-500 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-40"
        >
          {mode === 'login' ? '로그인 🚀' : '가입하고 시작하기 🚀'}
        </button>
      </div>
    </main>
  );
}
