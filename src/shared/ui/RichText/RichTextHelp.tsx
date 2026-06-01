'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { RichText } from './RichText';

const TAGS: { label: string; code: string }[] = [
  { label: '밑줄', code: '<u>단어</u>' },
  { label: '번호 밑줄 (어법/어휘)', code: '<u n="1">word</u>' },
  { label: '박스 / 네모', code: '<box>네모</box>' },
  { label: '원문자 (문장삽입 위치)', code: '<num>③</num>' },
  { label: '문단 (글의 순서)', code: '<p label="A">First...</p>' },
  { label: '빈칸 (빈칸추론)', code: '핵심은 <blank/> 이다' },
  { label: '굵게', code: '<b>강조</b>' },
];

/** Collapsible cheat sheet for 지문 마크업 태그, shown in the problem editors. */
export function RichTextHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:text-zinc-900"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        서식 태그 도움말 (밑줄·박스·원문자·문단·빈칸)
      </button>
      {open ? (
        <ul className="space-y-1.5 border-t border-zinc-200 px-2.5 py-2">
          {TAGS.map((t) => (
            <li
              key={t.label}
              className="grid grid-cols-[7.5rem_1fr_1fr] items-center gap-2 text-[12px]"
            >
              <span className="text-zinc-500">{t.label}</span>
              <code className="truncate rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700">
                {t.code}
              </code>
              <RichText text={t.code} className="text-zinc-800" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
