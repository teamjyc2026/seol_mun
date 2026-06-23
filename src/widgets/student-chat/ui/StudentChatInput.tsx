'use client';

import { Send } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

/** 학생용 한 줄 입력창 — 동그란 알약 모양 + 주황 전송 버튼. */
export function StudentChatInput({
  value,
  onChange,
  onSend,
  isSending,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isSending: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border-2 border-zinc-200 bg-white p-1.5 pl-5 shadow-lg">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // 한글 등 IME 조합 중 Enter(확정)는 전송하지 않는다.
          if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="모디한테 말 걸어봐! ✏️"
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-zinc-400"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={isSending || !value.trim()}
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-500 text-white shadow-md transition',
          'hover:bg-orange-600 active:scale-95 disabled:opacity-40',
        )}
        aria-label="전송"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
