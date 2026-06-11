'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { topicCategoriesFor } from '@/shared/config/topics';

/**
 * 대분류 칩 → 세부 토픽 칩 선택 (목록에 없으면 직접 입력 폴백).
 * value = 선택된 세부 토픽(또는 직접 입력 문자열) 1개.
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
  const [custom, setCustom] = useState(false);
  const activeCat = cats.find((c) => c.category === category) ?? null;
  const knownTopic = !!activeCat?.topics.includes(value);

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
                    onClick={() => {
                      setCustom(false);
                      onChange({ category, topic: active ? '' : t });
                    }}
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
              <button
                type="button"
                onClick={() => setCustom((v) => !v)}
                className={cn(
                  'rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium',
                  custom || (!knownTopic && value)
                    ? 'border-indigo-400 text-indigo-600'
                    : 'border-zinc-300 text-zinc-500',
                )}
              >
                직접 입력
              </button>
            </div>
          )}
        </>
      ) : null}
      {(custom || cats.length === 0 || (!knownTopic && value && !activeCat)) && (
        <input
          value={knownTopic ? '' : value}
          onChange={(e) => onChange({ category, topic: e.target.value })}
          placeholder="토픽 직접 입력 (예: 임진왜란)"
          className="h-8 w-full rounded-md border border-zinc-200 px-2 text-xs outline-none focus:border-indigo-400"
        />
      )}
      {value && (
        <p className="text-[11px] text-zinc-500">
          선택됨: <b className="text-zinc-700">{category ? `${category} › ` : ''}{value}</b>
        </p>
      )}
    </div>
  );
}
