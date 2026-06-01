'use client';

import { Paperclip, Send } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { Source } from '@/entities/source';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isSending: boolean;
  pinnedSources: Source[];
  onTogglePin: (id: string) => void;
  sources: Source[];
};

export function ChatInput({
  value,
  onChange,
  onSend,
  isSending,
  pinnedSources,
  onTogglePin,
  sources,
}: Props) {
  return (
    <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      {pinnedSources.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {pinnedSources.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onTogglePin(s.id)}
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
            >
              📎 {s.title}
              <span className="text-amber-500">×</span>
            </button>
          ))}
        </div>
      ) : null}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter = 전송, Shift+Enter = 줄바꿈.
          // 한글 등 IME 조합 중 Enter(확정)는 전송하지 않는다.
          if (
            e.key === 'Enter' &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing &&
            e.keyCode !== 229
          ) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="예) 임진왜란 객관식 3문제 만들어줘 (Enter 전송 · Shift+Enter 줄바꿈)"
        rows={3}
        className="min-h-[60px] w-full resize-y border-0 bg-transparent text-sm leading-relaxed outline-none placeholder:text-zinc-400"
      />

      <div className="flex items-center gap-2">
        <PinMenu sources={sources} pinned={pinnedSources} onTogglePin={onTogglePin} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={onSend}
          disabled={isSending || !value.trim()}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white shadow-md transition',
            'hover:bg-zinc-800 disabled:opacity-40',
          )}
        >
          <Send className="h-3.5 w-3.5" />
          {isSending ? '응답 중…' : '전송'}
        </button>
      </div>
    </div>
  );
}

function PinMenu({
  sources,
  pinned,
  onTogglePin,
}: {
  sources: Source[];
  pinned: Source[];
  onTogglePin: (id: string) => void;
}) {
  return (
    <details className="relative">
      <summary
        className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100"
      >
        <Paperclip className="h-3 w-3" />
        소스 핀
      </summary>
      <div className="absolute bottom-9 left-0 z-10 max-h-72 w-72 overflow-auto rounded-lg border border-zinc-200 bg-white p-2 shadow-lg">
        {sources.length === 0 ? (
          <p className="px-2 py-3 text-xs text-zinc-500">업로드된 소스가 없어요.</p>
        ) : (
          <ul className="space-y-1">
            {sources.map((s) => {
              const isPinned = pinned.some((p) => p.id === s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onTogglePin(s.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-zinc-50',
                      isPinned && 'bg-amber-50 text-amber-800',
                    )}
                  >
                    <input type="checkbox" checked={isPinned} readOnly />
                    <span className="truncate flex-1">{s.title}</span>
                    <span className="text-[10px] text-zinc-400">
                      {s.indexing_status === 'ready' ? '✓' : s.indexing_status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
