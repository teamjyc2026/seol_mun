'use client';

import { Download } from 'lucide-react';

export function ExportButton() {
  return (
    <a
      href="/api/admin/export"
      download
      title="엑셀 내보내기"
      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
    >
      <Download className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">엑셀 내보내기</span>
    </a>
  );
}
