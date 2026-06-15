'use client';

/** 설문이가 다음 말을 "치고 있는" 표시 — 버블 모양 + 점 3개. */
export function TypingDots() {
  return (
    <div className="inline-flex items-center gap-1 rounded-3xl rounded-bl-md border-2 border-zinc-100 bg-white px-4 py-3 shadow-sm">
      <span className="h-2 w-2 animate-bounce rounded-full bg-orange-400 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-orange-400 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-orange-400" />
    </div>
  );
}
