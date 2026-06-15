'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
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
  status: 'idle' | 'ocr' | 'ready' | 'failed' | 'saved';
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
const MIN_W = 24;
const MIN_H = 16;

type Pt = { x: number; y: number };
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

type DragState =
  | { kind: 'create'; start: Pt; rect: BoxRect }
  | { kind: 'move'; id: string; startPos: Pt; orig: BoxRect; rect: BoxRect }
  | { kind: 'resize'; id: string; handle: Handle; startPos: Pt; orig: BoxRect; rect: BoxRect };

const HANDLES: { h: Handle; cls: string; cursor: string }[] = [
  { h: 'nw', cls: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'nwse-resize' },
  { h: 'n', cls: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'ns-resize' },
  { h: 'ne', cls: 'right-0 top-0 translate-x-1/2 -translate-y-1/2', cursor: 'nesw-resize' },
  { h: 'e', cls: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  { h: 'se', cls: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2', cursor: 'nwse-resize' },
  { h: 's', cls: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2', cursor: 'ns-resize' },
  { h: 'sw', cls: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2', cursor: 'nesw-resize' },
  { h: 'w', cls: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
];

/** 핸들 드래그 → orig에서 변을 이동, 캔버스 경계·최소 크기 클램프, 변 교차 방지. */
function applyResize(
  orig: BoxRect,
  handle: Handle,
  dx: number,
  dy: number,
  bound: { w: number; h: number },
): BoxRect {
  let left = orig.x;
  let top = orig.y;
  let right = orig.x + orig.w;
  let bottom = orig.y + orig.h;
  if (handle.includes('w')) left = Math.min(Math.max(0, orig.x + dx), right - MIN_W);
  if (handle.includes('e'))
    right = Math.max(Math.min(bound.w, orig.x + orig.w + dx), left + MIN_W);
  if (handle.includes('n')) top = Math.min(Math.max(0, orig.y + dy), bottom - MIN_H);
  if (handle.includes('s'))
    bottom = Math.max(Math.min(bound.h, orig.y + orig.h + dy), top + MIN_H);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** 이동 → 캔버스 경계 안으로 클램프. */
function clampMove(orig: BoxRect, dx: number, dy: number, bound: { w: number; h: number }): BoxRect {
  const x = Math.min(Math.max(0, orig.x + dx), Math.max(0, bound.w - orig.w));
  const y = Math.min(Math.max(0, orig.y + dy), Math.max(0, bound.h - orig.h));
  return { x, y, w: orig.w, h: orig.h };
}

export function PdfBoxViewer({
  doc,
  pageNum,
  rotation = 0,
  boxes,
  selectedId,
  onSelect,
  onDelete,
  onCreate,
  onRecognize,
  onUpdateRect,
  canvasRef,
}: {
  doc: PDFDocumentProxy;
  pageNum: number;
  /** PDF 회전 (0/90/180/270). */
  rotation?: number;
  boxes: WorkBox[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** rect는 캔버스 내부 픽셀 좌표 */
  onCreate: (rect: BoxRect) => void;
  /** 미인식 박스의 "인식" 버튼 */
  onRecognize: (id: string) => void;
  /** 기존 박스 이동·리사이즈 커밋 (캔버스 내부 px) */
  onUpdateRect: (id: string, rect: BoxRect) => void;
  /** 부모가 크롭에 쓸 수 있도록 캔버스 ref 공유 */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [rendering, setRendering] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
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
        const viewport = page.getViewport({ scale: RENDER_SCALE, rotation });
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
  }, [doc, pageNum, rotation]);

  function syncRatio() {
    const canvas = canvasRef.current;
    if (!canvas || canvas.clientWidth === 0) return;
    setRatio(canvas.width / canvas.clientWidth);
  }

  // 캔버스 표시 폭이 바뀔 때마다(윈도우 리사이즈 + 보조 뷰어 열림/닫힘 같은
  // 레이아웃 변화) 비율을 다시 잡아 박스 오버레이가 함께 줄도록 한다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => syncRatio());
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function bound(): { w: number; h: number } {
    const canvas = canvasRef.current;
    return { w: canvas?.width ?? 0, h: canvas?.height ?? 0 };
  }

  /** 마우스 위치 → 캔버스 내부 픽셀 좌표 */
  function pos(e: React.MouseEvent): Pt {
    const box = wrapRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - box.left, 0), box.width) * ratio,
      y: Math.min(Math.max(e.clientY - box.top, 0), box.height) * ratio,
    };
  }

  // 빈 캔버스에서 시작 → 새 박스 그리기
  function onWrapMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const p = pos(e);
    setDrag({ kind: 'create', start: p, rect: { x: p.x, y: p.y, w: 0, h: 0 } });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drag) return;
    const p = pos(e);
    if (drag.kind === 'create') {
      setDrag({
        ...drag,
        rect: {
          x: Math.min(drag.start.x, p.x),
          y: Math.min(drag.start.y, p.y),
          w: Math.abs(p.x - drag.start.x),
          h: Math.abs(p.y - drag.start.y),
        },
      });
    } else if (drag.kind === 'move') {
      const rect = clampMove(drag.orig, p.x - drag.startPos.x, p.y - drag.startPos.y, bound());
      setDrag({ ...drag, rect });
    } else {
      const rect = applyResize(
        drag.orig,
        drag.handle,
        p.x - drag.startPos.x,
        p.y - drag.startPos.y,
        bound(),
      );
      setDrag({ ...drag, rect });
    }
  }

  function onMouseUp() {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (d.kind === 'create') {
      if (d.rect.w >= MIN_W && d.rect.h >= MIN_H) onCreate(d.rect);
      return;
    }
    // move/resize: 의미 있는 변화가 있으면 커밋
    const moved =
      Math.abs(d.rect.x - d.orig.x) > 1 ||
      Math.abs(d.rect.y - d.orig.y) > 1 ||
      Math.abs(d.rect.w - d.orig.w) > 1 ||
      Math.abs(d.rect.h - d.orig.h) > 1;
    if (moved) onUpdateRect(d.id, d.rect);
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
      onMouseDown={onWrapMouseDown}
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
        const live =
          drag && (drag.kind === 'move' || drag.kind === 'resize') && drag.id === b.id
            ? drag.rect
            : b.rect;
        const d = toDisplay(live);
        const selected = b.id === selectedId;
        return (
          <div
            key={b.id}
            data-box-id={b.id}
            className={cn(
              'absolute cursor-move border-2',
              b.status === 'failed'
                ? 'border-rose-500 bg-rose-500/10'
                : b.status === 'idle'
                  ? 'border-dashed border-zinc-400 bg-zinc-400/10'
                  : KIND_BOX_CLASS[b.kind],
              selected && 'ring-2 ring-zinc-900/40',
              b.status === 'saved' && 'opacity-80',
            )}
            style={d}
            onMouseDown={(e) => {
              e.stopPropagation();
              onSelect(b.id);
              setDrag({ kind: 'move', id: b.id, startPos: pos(e), orig: b.rect, rect: b.rect });
            }}
          >
            <span
              className={cn(
                'absolute -left-px -top-6 inline-flex items-center gap-1 rounded-t-md px-1.5 py-0.5 text-[10px] font-bold text-white',
                KIND_BADGE_CLASS[b.kind],
              )}
            >
              {i + 1} {b.status === 'idle' ? '미인식' : KIND_LABEL[b.kind]}
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
            {/* 미인식 박스: 가운데 인식 버튼 */}
            {b.status === 'idle' && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onRecognize(b.id);
                }}
                className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-zinc-900/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg hover:bg-zinc-900"
              >
                <Sparkles className="h-3.5 w-3.5" /> 인식
              </button>
            )}
            {/* 선택된 박스에만 8방향 리사이즈 핸들 */}
            {selected &&
              HANDLES.map(({ h, cls, cursor }) => (
                <span
                  key={h}
                  className={cn(
                    'absolute h-2.5 w-2.5 rounded-full border border-white bg-zinc-900',
                    cls,
                  )}
                  style={{ cursor }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDrag({
                      kind: 'resize',
                      id: b.id,
                      handle: h,
                      startPos: pos(e),
                      orig: b.rect,
                      rect: b.rect,
                    });
                  }}
                />
              ))}
          </div>
        );
      })}

      {drag?.kind === 'create' && drag.rect.w > 0 && (
        <div
          className="absolute border-2 border-dashed border-indigo-500 bg-indigo-500/10"
          style={toDisplay(drag.rect)}
        />
      )}
    </div>
  );
}
