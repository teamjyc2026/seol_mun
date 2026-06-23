'use client';

import { Suspense, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/shared/lib/cn';
import { useMergeState } from '@/shared/lib/mergeReducer';

type Mode = 'admin' | 'login' | 'signup';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [f, set] = useMergeState(() => ({
    mode: (search.get('as') === 'uploader' ? 'login' : 'admin') as Mode,
    email: '',
    pw: '',
    pw2: '',
    nickname: '',
    invite: '',
    show: false,
    err: '',
    loading: false,
  }));
  const [isPending, startTransition] = useTransition();

  const isAdmin = f.mode === 'admin';
  const isSignup = f.mode === 'signup';
  const dest = isAdmin ? '/admin' : '/admin/agent';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    set({ err: '' });
    if (isSignup && f.pw !== f.pw2) {
      set({ err: '비밀번호가 일치하지 않습니다.' });
      return;
    }
    set({ loading: true });
    try {
      const url = isAdmin
        ? '/api/admin/login'
        : isSignup
          ? '/api/uploader/signup'
          : '/api/uploader/login';
      const payload = isAdmin
        ? { password: f.pw }
        : isSignup
          ? { email: f.email, password: f.pw, nickname: f.nickname, inviteCode: f.invite }
          : { email: f.email, password: f.pw };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? '처리 중 오류가 발생했어요.');
      }
      startTransition(() => {
        router.replace(dest);
        router.refresh();
      });
    } catch (e) {
      set({ err: e instanceof Error ? e.message : '오류가 발생했어요.', loading: false });
    }
  }

  function switchMode(next: Mode) {
    set({ mode: next, err: '', pw: '', pw2: '' });
  }

  const busy = f.loading || isPending;
  const canSubmit = isAdmin
    ? f.pw.length > 0
    : isSignup
      ? f.email && f.pw && f.pw2 && f.nickname.trim() && f.invite
      : f.email && f.pw;

  return (
    <main className="grid min-h-svh place-items-center bg-zinc-50 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg"
      >
        <div className="space-y-1.5 text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-zinc-900 text-white">
            {isAdmin ? <Lock className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          </div>
          <h1 className="text-lg font-bold text-zinc-900">
            {isAdmin ? '관리자 로그인' : isSignup ? '선생님 회원가입' : '선생님 로그인'}
          </h1>
          <p className="text-xs text-zinc-500">
            {isAdmin
              ? '대시보드 접근에는 비밀번호가 필요해요.'
              : isSignup
                ? '가입하면 문제를 올리고 학생 기록을 볼 수 있어요.'
                : '선생님 계정(이메일)으로 로그인하세요.'}
          </p>
        </div>

        <div className="space-y-2.5">
          {!isAdmin ? (
            <Input
              type="email"
              value={f.email}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="이메일"
              autoFocus
              autoComplete="email"
            />
          ) : null}

          <div className="relative">
            <Input
              type={f.show ? 'text' : 'password'}
              value={f.pw}
              onChange={(e) => set({ pw: e.target.value })}
              placeholder={isSignup ? '비밀번호 (6자 이상)' : '비밀번호'}
              autoFocus={isAdmin}
              autoComplete={isAdmin ? 'current-password' : isSignup ? 'new-password' : 'current-password'}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => set({ show: !f.show })}
              aria-label={f.show ? '비밀번호 가리기' : '비밀번호 표시'}
              tabIndex={-1}
              className={cn(
                'absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md',
                'text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700',
              )}
            >
              {f.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {isSignup ? (
            <>
              <Input
                type={f.show ? 'text' : 'password'}
                value={f.pw2}
                onChange={(e) => set({ pw2: e.target.value })}
                placeholder="비밀번호 다시 입력"
                autoComplete="new-password"
              />
              <Input
                value={f.nickname}
                onChange={(e) => set({ nickname: e.target.value })}
                placeholder="별명 (문제 작성자로 표시돼요)"
                maxLength={40}
              />
              <Input
                value={f.invite}
                onChange={(e) => set({ invite: e.target.value })}
                placeholder="초대코드"
              />
            </>
          ) : null}

          {f.err ? <p className="text-sm text-rose-600">{f.err}</p> : null}
        </div>

        <button
          type="submit"
          disabled={busy || !canSubmit}
          className="h-10 w-full rounded-lg bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy ? '진입 중…' : isSignup ? '회원가입' : '로그인'}
        </button>

        <div className="space-y-1 text-center text-xs text-zinc-500">
          {isAdmin ? (
            <p>
              선생님이신가요?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-medium text-zinc-900 underline-offset-2 hover:underline"
              >
                이메일 로그인 · 가입
              </button>
            </p>
          ) : (
            <>
              <p>
                {isSignup ? '이미 계정이 있나요? ' : '계정이 없나요? '}
                <button
                  type="button"
                  onClick={() => switchMode(isSignup ? 'login' : 'signup')}
                  className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                >
                  {isSignup ? '로그인' : '회원가입'}
                </button>
              </p>
              <p>
                <button
                  type="button"
                  onClick={() => switchMode('admin')}
                  className="text-zinc-400 underline-offset-2 hover:underline"
                >
                  관리자 비밀번호로 로그인
                </button>
              </p>
            </>
          )}
        </div>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
