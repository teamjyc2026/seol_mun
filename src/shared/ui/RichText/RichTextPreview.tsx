'use client';

import { cn } from '@/shared/lib/cn';
import { RichText } from './RichText';

/** One-line cheat sheet shown under markup-enabled editor fields. */
export const RICH_TEXT_HINT =
  '서식 태그: <u>밑줄</u> · <u n="1">번호밑줄</u> · <box>네모</box> · <num>③</num> · <p label="A">문단</p> · <blank/> · <b>굵게</b>';

/** Live render of a markup textarea value, for admin editors. */
export function RichTextPreview({
  value,
  className,
  label = '미리보기',
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  if (!value.trim()) return null;
  return (
    <div
      className={cn(
        'rounded-md border border-dashed border-zinc-200 bg-zinc-50/70 px-3 py-2',
        className,
      )}
    >
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">{label}</p>
      <RichText text={value} className="text-sm leading-relaxed text-zinc-800" />
    </div>
  );
}
