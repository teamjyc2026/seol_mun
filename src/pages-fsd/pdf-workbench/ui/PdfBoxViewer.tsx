'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { cn } from '@/shared/lib/cn';

/** 박스 좌표는 캔버스 내부 픽셀 기준 (리사이즈와 무관). */
export type BoxRect = { x: number; y: number; w: number; h: number };

export type BoxKind = 'problem' | 'concept' | 'passage';

export type WorkBox = {
  id: string;
  page: number;
  rect: BoxRect;
  kind: BoxKind;
  status: 'ocr' | 'ready' | 'failed' | 'saved';
};

export const KIND_LABEL: Record<BoxKind, string> = {
  problem: '문제',
  concept: '개념',
  passage: '본문',
};

const KIND_BOX_CLASS: Record<BoxKind, string> = {
  problem: 'border-indigo-500 bg-indigo-500/10',
  concept: 'border-amber-500 bg-amber-500/10',
  passage: 'border-emerald-500 bg-emerald-500/10',
};

const KIND_BADGE_CLASS: Record<BoxKind, string> = {
  problem: 'bg-indigo-600',
  concept: 'bg-amber-600',
  passage: 'bg-emerald-600',
};

const RENDER_SCALE = 1.5;

export function PdfBoxViewer({
  doc,
  pageNum,
  boxes,
  selectedId,
  onSelect,
  onDelete,
  onCreate,
  canvasRef,
}: {
  doc: PDFDocumentProxy;
  pageNum: number;
  boxes: WorkBox[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** rect는 캔버스 내부 픽셀 좌표 */
  onCreate: (rect: BoxRect) => void;
  /** 부모가 크롭에 쓸 수 있도록 캔버스 ref 공유 */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [rendering, setRendering] = useState(false);
  const [drag, setDrag] = useState<{ start: { x: number; y: number }; rect: BoxRect } | null>(null);
  // display(px) = internal(px) / ratio
  const [ratio, setRatio] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setRendering(true);
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (!cancelled) syncRatio();
      } finally {
        if (!cancelled) setRendering(false);
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pageNum]);

  function syncRatio() {
    const canvas = canvasRef.current;
    if (!canvas || canvas.clientWidth === 0) return;
    setRatio(canvas.width / canvas.clientWidth);
  }

  useEffect(() => {
    const onResize = () => syncRatio();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 마우스 위치 → 캔버스 내부 픽셀 좌표 */
  function pos(e: React.MouseEvent): { x: number; y: number } {
    const box = wrapRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - box.left, 0), box.width) * ratio,
      y: Math.min(Math.max(e.clientY - box.top, 0), box.height) * ratio,
    };
  }

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const p = pos(e);
    setDrag({ start: p, rect: { x: p.x, y: p.y, w: 0, h: 0 } });
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!drag) return;
    const p = pos(e);
    setDrag({
      start: drag.start,
      rect: {
        x: Math.min(drag.start.x, p.x),
        y: Math.min(drag.start.y, p.y),
        w: Math.abs(p.x - drag.start.x),
        h: Math.abs(p.y - drag.start.y),
      },
    });
  }
  function onMouseUp() {
    if (!drag) return;
    const r = drag.rect;
    setDrag(null);
    if (r.w >= 24 && r.h >= 16) onCreate(r);
  }

  const toDisplay = (r: BoxRect) => ({
    left: r.x / ratio,
    top: r.y / ratio,
    width: r.w / ratio,
    height: r.h / ratio,
  });

  const pageBoxes = boxes.filter((b) => b.page === pageNum);

  return (
    <div
      ref={wrapRef}
      className="relative inline-block max-w-full cursor-crosshair select-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <canvas
        ref={canvasRef}
        className="block max-w-full rounded-md border border-zinc-200 bg-white"
        style={{ height: 'auto' }}
      />
      {rendering && (
        <div className="absolute inset-0 grid place-items-center bg-white/60">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      )}

      {pageBoxes.map((b, i) => {
        const d = toDisplay(b.rect);
        const selected = b.id === selectedId;
        return (
          <div
            key={b.id}
            data-box-id={b.id}
            className={cn(
              'absolute border-2',
              b.status === 'failed'
                ? 'border-rose-500 bg-rose-500/10'
                : KIND_BOX_CLASS[b.kind],
              selected && 'ring-2 ring-zinc-900/40',
              b.status === 'saved' && 'opacity-80',
            )}
            style={d}
            onMouseDown={(e) => {
              e.stopPropagation();
              onSelect(b.id);
            }}
          >
            <span
              className={cn(
                'absolute -left-px -top-6 inline-flex items-center gap-1 rounded-t-md px-1.5 py-0.5 text-[10px] font-bold text-white',
                KIND_BADGE_CLASS[b.kind],
              )}
            >
              {i + 1} {KIND_LABEL[b.kind]}
              {b.status === 'ocr' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              {b.status === 'saved' && '✓'}
            </span>
            <button
              type="button"
              className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-zinc-700 text-white hover:bg-rose-600"
              onMouseDown={(e) => {
                e.stopPropagation();
                onDelete(b.id);
              }}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        );
      })}

      {drag && drag.rect.w > 0 && (
        <div
          className="absolute border-2 border-dashed border-indigo-500 bg-indigo-500/10"
          style={toDisplay(drag.rect)}
        />
      )}
    </div>
  );
}
