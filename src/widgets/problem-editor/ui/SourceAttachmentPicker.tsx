'use client';

import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Source } from '@/entities/source';
import type { ProblemCitation } from '@/entities/problem';

export function SourceAttachmentPicker({
  sources,
  citations,
  onChange,
}: {
  sources: Source[];
  citations: ProblemCitation[];
  onChange: (next: ProblemCitation[]) => void;
}) {
  function add() {
    if (sources.length === 0) return;
    onChange([
      ...citations,
      {
        sourceId: sources[0].id,
        sourceTitle: sources[0].title,
        page: null,
        snippet: '',
      },
    ]);
  }
  function update(i: number, patch: Partial<ProblemCitation>) {
    const next = citations.slice();
    next[i] = { ...next[i], ...patch };
    if (patch.sourceId) {
      const src = sources.find((s) => s.id === patch.sourceId);
      next[i].sourceTitle = src?.title;
    }
    onChange(next);
  }
  function remove(i: number) {
    onChange(citations.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-zinc-700">
          출처 (선택, 여러 개 가능)
        </Label>
        <button
          type="button"
          onClick={add}
          disabled={sources.length === 0}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
        >
          <Plus className="h-3 w-3" /> 추가
        </button>
      </div>
      {citations.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-200 bg-zinc-50/60 px-3 py-3 text-xs text-zinc-500">
          출처가 없어도 저장할 수 있어요. 필요 시 "추가"로 소스를 연결하세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {citations.map((c, i) => (
            <li
              key={i}
              className="space-y-2 rounded-md border border-zinc-200 bg-white p-2.5"
            >
              <div className="grid grid-cols-[1fr_80px_28px] items-end gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-medium text-zinc-500">소스</span>
                  <select
                    value={c.sourceId}
                    onChange={(e) => update(i, { sourceId: e.target.value })}
                    className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs"
                  >
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-medium text-zinc-500">페이지</span>
                  <Input
                    type="number"
                    min={1}
                    value={c.page ?? ''}
                    onChange={(e) =>
                      update(i, {
                        page: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="h-8"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="inline-flex h-8 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea
                value={c.snippet}
                onChange={(e) => update(i, { snippet: e.target.value })}
                rows={2}
                placeholder="발췌 (선택)"
                className="block w-full resize-y rounded-md border border-zinc-200 px-2 py-1.5 text-xs outline-none"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
