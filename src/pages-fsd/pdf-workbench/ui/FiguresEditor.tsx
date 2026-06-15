'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import type { ProblemFigure } from '@/entities/problem';

/** 문제·개념·본문 공용 그림/도표 편집기 (썸네일 + 캡션 + 그림별 해설 + 직접 업로드). */
export function FiguresEditor({
  figures,
  onChange,
  uploadFigure,
  hint,
}: {
  figures: ProblemFigure[];
  onChange: (figures: ProblemFigure[]) => void;
  /** 파일을 Storage에 올리고 public URL을 돌려준다 (실패 시 null). */
  uploadFigure: (file: File) => Promise<string | null>;
  hint?: string;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  function upd(i: number, patch: Partial<ProblemFigure>) {
    const next = figures.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function remove(i: number) {
    onChange(figures.filter((_, idx) => idx !== i));
  }
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFigure(file);
      if (url) onChange([...figures, { url }]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-700">그림/도표 (선택)</label>
      {hint ? <p className="text-[11px] leading-relaxed text-zinc-400">{hint}</p> : null}
      {figures.length > 0 && (
        <ul className="space-y-2">
          {figures.map((fig, i) => (
            <li key={i} className="flex gap-2 rounded-lg border border-zinc-200 bg-zinc-50/50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fig.url}
                alt={fig.caption || `그림 ${i + 1}`}
                className="h-20 w-20 shrink-0 rounded border border-zinc-200 bg-white object-contain"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <input
                  value={fig.caption ?? ''}
                  onChange={(e) => upd(i, { caption: e.target.value })}
                  placeholder="캡션 (예: [그림 1])"
                  className="h-7 w-full rounded-md border border-zinc-200 px-2 text-xs outline-none"
                />
                <textarea
                  value={fig.explanation ?? ''}
                  onChange={(e) => upd(i, { explanation: e.target.value })}
                  rows={2}
                  placeholder="이 그림에 대한 해설 (선택)"
                  className="block w-full resize-y rounded-md border border-zinc-200 px-2 py-1 text-xs outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                title="그림 삭제"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
        그림 직접 올리기
      </button>
    </div>
  );
}
