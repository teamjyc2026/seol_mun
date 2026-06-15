'use client';

import { cn } from '@/shared/lib/cn';
import { PILL_PALETTE } from '../config/theme';

/** 답변 끝에 붙는 선택지 버튼 — 누르면 그 문구가 그대로 전송된다. */
export function QuickReplies({
  choices,
  onPick,
  disabled,
  big,
}: {
  choices: string[];
  onPick: (label: string) => void;
  disabled?: boolean;
  /** 빈 화면 스타터용 — 2열 그리드 큰 버튼. */
  big?: boolean;
}) {
  if (choices.length === 0) return null;
  return (
    <div className={cn(big ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-2')}>
      {choices.map((label, i) => (
        <button
          key={`${label}-${i}`}
          type="button"
          disabled={disabled}
          onClick={() => onPick(label)}
          style={{ animationDelay: `${i * 80}ms` }}
          className={cn(
            'animate-in fade-in zoom-in-95 inline-flex min-h-11 items-center justify-center rounded-full border-2 border-b-4 px-4 py-2 text-sm font-bold transition disabled:opacity-40',
            big && 'rounded-2xl py-3 text-base',
            PILL_PALETTE[i % PILL_PALETTE.length],
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
