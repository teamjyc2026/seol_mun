'use client';

import { cn } from '@/shared/lib/cn';
import { topicCategoriesFor } from '@/shared/config/topics';

/**
 * 대분류 칩 → 세부 토픽 칩 선택. 과목에 분류 목록이 있으면 **반드시 목록에서만**
 * 고르게 한다(자유 입력 금지). 목록이 아예 없는 과목만 직접 입력으로 폴백.
 * value = 선택된 세부 토픽 1개.
 */
export function TopicPicker({
  subject,
  category,
  value,
  onChange,
}: {
  subject: string;
  category: string | null;
  value: string;
  onChange: (next: { category: string | null; topic: string }) => void;
}) {
  const cats = topicCategoriesFor(subject);
  const activeCat = cats.find((c) => c.category === category) ?? null;
  // 목록에 없는 토픽이 들어와 있으면(OCR 오분류 등) 사용자가 다시 고르게 알린다.
  const offList = !!value && (!activeCat || !activeCat.topics.includes(value));

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-700">분류</label>
      {cats.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-1">
            {cats.map((c) => {
              const active = c.category === category;
              return (
                <button
                  key={c.category}
                  type="button"
                  onClick={() =>
                    onChange({ category: active ? null : c.category, topic: '' })
                  }
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                    active
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                  )}
                >
                  {c.category}
                </button>
              );
            })}
          </div>
          {activeCat && (
            <div className="flex flex-wrap gap-1 rounded-lg bg-zinc-50 p-2">
              {activeCat.topics.map((t) => {
                const active = t === value;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange({ category, topic: active ? '' : t })}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] font-medium transition',
                      active
                        ? 'border-indigo-500 bg-indigo-100 text-indigo-800'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100',
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          )}
          {offList && (
            <p className="text-[11px] text-amber-600">
              ⚠ 분류를 목록에서 골라주세요{value ? ` (현재 “${value}”는 목록에 없음)` : ''}.
            </p>
          )}
        </>
      ) : (
        // 분류 목록이 없는 과목만 자유 입력.
        <input
          value={value}
          onChange={(e) => onChange({ category, topic: e.target.value })}
          placeholder="토픽 입력 (예: 임진왜란)"
          className="h-8 w-full rounded-md border border-zinc-200 px-2 text-xs outline-none focus:border-indigo-400"
        />
      )}
      {value && !offList && (
        <p className="text-[11px] text-zinc-500">
          선택됨: <b className="text-zinc-700">{category ? `${category} › ` : ''}{value}</b>
        </p>
      )}
    </div>
  );
}
