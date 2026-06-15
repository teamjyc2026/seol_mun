'use client';

import { Markdown } from '@/shared/ui/Markdown/Markdown';
import { cn } from '@/shared/lib/cn';

/** 학생 채팅 말풍선 한 개. assistant는 분할된 세그먼트 단위로 여러 개 그려진다. */
export function StudentBubble({
  role,
  text,
  animate,
}: {
  role: 'user' | 'assistant';
  text: string;
  animate?: boolean;
}) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl rounded-br-md bg-orange-500 px-4 py-2.5 text-[15px] font-medium leading-relaxed text-white shadow-sm">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'max-w-[85%] rounded-3xl rounded-bl-md border-2 border-zinc-100 bg-white px-4 py-2.5 text-[15px] leading-relaxed text-zinc-800 shadow-sm',
        animate && 'bubble-pop',
      )}
    >
      <Markdown>{text}</Markdown>
    </div>
  );
}
