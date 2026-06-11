'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Bot, BookOpen, FileText, Menu, School, Scissors, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { AdminAccountMenu } from '@/widgets/admin-account-menu';

type NavItem = { href: string; label: string; icon: typeof Bot };

const NAV: NavItem[] = [
  { href: '/admin/agent', label: '에이전트', icon: Bot },
  { href: '/admin/agent/workbench', label: 'PDF 워크벤치', icon: Scissors },
  { href: '/admin/agent/sources', label: '교재 업로드', icon: BookOpen },
  { href: '/admin/agent/problems', label: '문제 업로드', icon: FileText },
  { href: '/admin/agent/schools', label: '학교 RAG', icon: School },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin/agent') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'inline-flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
              active
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-700 hover:bg-zinc-100',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Every drawer link/backdrop closes via onClick, so no route-change effect needed.

  const current = NAV.find((n) => isActive(pathname, n.href))?.label ?? '학습 에이전트';

  return (
    <div className="min-h-svh bg-zinc-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-zinc-200 bg-white px-3 py-4 md:flex">
        <div className="flex items-center gap-2 px-2 pb-3 text-sm font-bold text-zinc-900">
          🤖 학습 에이전트
        </div>
        <NavLinks pathname={pathname} />
        <div className="mt-auto flex flex-col gap-2 border-t border-zinc-100 pt-3">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" /> 대시보드
          </Link>
          <div className="px-1">
            <AdminAccountMenu />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-zinc-200 bg-white px-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="flex-1 truncate text-sm font-bold text-zinc-900">{current}</span>
        <AdminAccountMenu />
      </header>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 md:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={cn(
            'absolute inset-0 bg-zinc-900/40 transition-opacity duration-200',
            open ? 'opacity-100' : 'opacity-0',
          )}
        />
        <aside
          className={cn(
            'absolute inset-y-0 left-0 flex w-64 flex-col bg-white px-3 py-4 shadow-xl transition-transform duration-200',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between px-2 pb-3">
            <span className="text-sm font-bold text-zinc-900">🤖 학습 에이전트</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="메뉴 닫기"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          <div className="mt-auto border-t border-zinc-100 pt-3">
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" /> 대시보드
            </Link>
          </div>
        </aside>
      </div>

      {/* Content */}
      <div className="md:pl-56">{children}</div>
    </div>
  );
}
