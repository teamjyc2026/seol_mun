'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, LogOut, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { cn } from '@/shared/lib/cn';

type Account = { email: string; nickname: string };

export function AdminAccountMenu({ className }: { className?: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/uploader/account')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Account | null) => {
        if (d) {
          setAccount(d);
          setNickname(d.nickname);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function saveNickname() {
    const next = nickname.trim();
    if (!next || next === account?.nickname) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/uploader/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? '실패');
      const d = (await res.json()) as Account;
      setAccount(d);
      setNickname(d.nickname);
      setEditing(false);
      toast.success('별명을 변경했어요.');
      router.refresh();
    } catch (e) {
      toast.error(String((e as { message?: string })?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch('/api/uploader/logout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  }

  // Reserve the chip's footprint while loading so the header doesn't shift.
  if (loading) {
    return (
      <div className={cn('skeleton-shimmer h-8 w-28 rounded-full', className)} aria-hidden />
    );
  }
  if (!account) return null;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 max-w-[10rem] items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-zinc-900 text-[10px] text-white">
          {account.nickname.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{account.nickname}</span>
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
          <div className="px-2 py-1.5">
            <p className="truncate text-xs text-zinc-400">{account.email}</p>
          </div>

          {editing ? (
            <div className="flex items-center gap-1.5 px-1 py-1">
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={40}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveNickname();
                  if (e.key === 'Escape') {
                    setEditing(false);
                    setNickname(account.nickname);
                  }
                }}
                className="h-8 text-sm"
              />
              <button
                type="button"
                onClick={saveNickname}
                disabled={saving}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                aria-label="저장"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setNickname(account.nickname);
                }}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100"
                aria-label="취소"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100"
            >
              <User className="h-4 w-4 text-zinc-400" /> 별명 변경
            </button>
          )}

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-rose-600 transition hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" /> 로그아웃
          </button>
        </div>
      ) : null}
    </div>
  );
}
