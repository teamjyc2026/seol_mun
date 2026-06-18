'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import {
  topicCategoriesFor,
  topicLeafPaths,
  topicNodeLabel,
  TOPIC_PATH_SEP,
  TOPIC_TAG_SEP,
  type TopicNode,
} from '@/shared/config/topics';

/**
 * 대분류 → 토픽(3단계면 하위까지) **다중 선택**. 과목에 분류 목록이 있으면 목록에서만
 * 고르게 한다(자유 입력 금지). value = 쉼표로 구분된 선택 태그들("시제 > 현재완료, 관계대명사").
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
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  const selected = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const sel = new Set(selected);
  const valid = topicLeafPaths(subject);
  const offTags = cats.length > 0 ? selected.filter((t) => !valid.has(t)) : [];

  const emit = (tags: string[]) =>
    onChange({ category, topic: Array.from(new Set(tags)).join(TOPIC_TAG_SEP) });
  const toggle = (tag: string) =>
    emit(sel.has(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);

  const subTags = (n: Extract<TopicNode, object>) =>
    n.sub.map((s) => `${n.topic}${TOPIC_PATH_SEP}${s}`);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-700">분류 (여러 개 선택 가능)</label>

      {cats.length === 0 ? (
        <input
          value={value}
          onChange={(e) => onChange({ category, topic: e.target.value })}
          placeholder="토픽 입력 (예: 임진왜란)"
          className="h-8 w-full rounded-md border border-zinc-200 px-2 text-xs outline-none focus:border-indigo-400"
        />
      ) : (
        <>
          {/* 선택된 태그(제거 가능) */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selected.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle(t)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    valid.has(t)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-amber-100 text-amber-700',
                  )}
                  title="클릭해서 제거"
                >
                  {t} ✕
                </button>
              ))}
            </div>
          )}

          {/* 대분류 (탐색) */}
          <div className="flex flex-wrap gap-1">
            {cats.map((c) => {
              const active = c.category === category;
              return (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => {
                    setOpenTopic(null);
                    onChange({ category: active ? null : c.category, topic: value });
                  }}
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

          {/* 토픽 (평면=토글, 3단계=펼침) */}
          {activeCat && (
            <div className="space-y-1.5 rounded-lg bg-zinc-50 p-2">
              <div className="flex flex-wrap gap-1">
                {activeCat.topics.map((t) => {
                  if (typeof t === 'string') {
                    const on = sel.has(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggle(t)}
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11px] font-medium transition',
                          on
                            ? 'border-indigo-500 bg-indigo-100 text-indigo-800'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100',
                        )}
                      >
                        {t}
                      </button>
                    );
                  }
                  const open = openTopic === t.topic;
                  const anySel = sel.has(t.topic) || subTags(t).some((s) => sel.has(s));
                  return (
                    <button
                      key={t.topic}
                      type="button"
                      onClick={() => setOpenTopic(open ? null : t.topic)}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[11px] font-medium transition',
                        anySel
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100',
                      )}
                    >
                      {topicNodeLabel(t)} {open ? '▾' : '▸'}
                    </button>
                  );
                })}
              </div>
              {/* 펼친 토픽의 하위 */}
              {openTopic &&
                (() => {
                  const node = activeCat.topics.find(
                    (t): t is Extract<TopicNode, object> =>
                      typeof t !== 'string' && t.topic === openTopic,
                  );
                  if (!node) return null;
                  return (
                    <div className="flex flex-wrap gap-1 border-t border-zinc-200 pt-1.5">
                      <button
                        type="button"
                        onClick={() => toggle(node.topic)}
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11px] font-medium transition',
                          sel.has(node.topic)
                            ? 'border-indigo-500 bg-indigo-100 text-indigo-800'
                            : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100',
                        )}
                      >
                        {node.topic} 전체
                      </button>
                      {node.sub.map((s) => {
                        const tag = `${node.topic}${TOPIC_PATH_SEP}${s}`;
                        const on = sel.has(tag);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggle(tag)}
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[11px] font-medium transition',
                              on
                                ? 'border-indigo-500 bg-indigo-100 text-indigo-800'
                                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100',
                            )}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
            </div>
          )}

          {offTags.length > 0 && (
            <p className="text-[11px] text-amber-600">
              ⚠ 목록에 없는 분류: {offTags.join(', ')} (클릭해 제거하거나 목록에서 다시 선택)
            </p>
          )}
        </>
      )}
    </div>
  );
}
