'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/cn';
import { MASCOT_NAME, MascotAvatar } from '@/widgets/student-chat';

const GRADE_GROUPS: { label: string; grades: string[] }[] = [
  { label: '초등', grades: ['초1', '초2', '초3', '초4', '초5', '초6'] },
  { label: '중등', grades: ['중1', '중2', '중3'] },
  { label: '고등', grades: ['고1', '고2', '고3'] },
];

export function StudentAuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (mode === 'signup') {
      if (password.length < 6) {
        toast.error('비밀번호는 6자 이상이어야 해요.');
        return;
      }
      if (password !== confirm) {
        toast.error('비밀번호가 일치하지 않아요.');
        return;
      }
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/student/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'login'
            ? { email: email.trim(), password }
            : {
                email: email.trim(),
                password,
                name,
                grade: grade || undefined,
                school: school || undefined,
              },
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

  const inputCls =
    'w-full rounded-2xl border-2 border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-orange-400';

  return (
    <main className="grid min-h-svh place-items-center bg-gradient-to-b from-orange-50/70 via-white to-white px-4">
      <div className="w-full max-w-sm space-y-4 rounded-3xl border-2 border-zinc-100 bg-white p-6 shadow-lg">
        <div className="flex flex-col items-center gap-2 text-center">
          <MascotAvatar size="xl" />
          <h1 className="text-lg font-extrabold tracking-tight text-zinc-900">
            {MASCOT_NAME}랑 공부 시작! 🦊
          </h1>
          <p className="text-xs text-zinc-500">
            {mode === 'login'
              ? '다시 왔구나! 반가워 👋'
              : `AI 학습 친구 ${MASCOT_NAME}랑 같이 공부하자!`}
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
                className={inputCls}
              />
              <input
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="학교 (예: OO중학교)"
                className={inputCls}
              />
              <div className="relative">
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className={cn(
                    inputCls,
                    'appearance-none bg-white pr-10',
                    grade ? 'text-zinc-900' : 'text-zinc-400',
                  )}
                >
                  <option value="">학년 선택 (선택)</option>
                  {GRADE_GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.grades.map((gr) => (
                        <option key={gr} value={gr} className="text-zinc-900">
                          {gr}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              </div>
            </>
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={inputCls}
          />
          <div className="relative">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && mode === 'login' && submit()}
              placeholder="비밀번호 (6자 이상)"
              type={showPw ? 'text' : 'password'}
              className={cn(inputCls, 'pr-11')}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {mode === 'signup' && (
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="비밀번호 확인"
              type={showPw ? 'text' : 'password'}
              className={cn(
                inputCls,
                confirm && confirm !== password && 'border-rose-300 focus:border-rose-400',
              )}
            />
          )}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={
            busy || !email || !password || (mode === 'signup' && (!name || !confirm))
          }
          className="w-full rounded-full bg-orange-500 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-40"
        >
          {mode === 'login' ? '로그인 🚀' : '가입하고 시작하기 🚀'}
        </button>
      </div>
    </main>
  );
}
