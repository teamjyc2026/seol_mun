'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { cn } from '@/shared/lib/cn';
import { HANDLES, MIN_H, MIN_W, boxDragReducer, type Pt } from '../lib/dragSelection';

/** 박스 좌표는 캔버스 내부 픽셀 기준 (리사이즈와 무관). */
export type BoxRect = { x: number; y: number; w: number; h: number };

export type BoxKind = 'problem' | 'problemset' | 'concept' | 'passage';

export type WorkBox = {
  id: string;
  page: number;
  rect: BoxRect;
  kind: BoxKind;
  status: 'idle' | 'ocr' | 'ready' | 'failed' | 'saved';
};

export const KIND_LABEL: Record<BoxKind, string> = {
  problem: '문제',
  problemset: '문제 세트',
  concept: '개념',
  passage: '본문',
};

const KIND_BOX_CLASS: Record<BoxKind, string> = {
  problem: 'border-indigo-500 bg-indigo-500/10',
  problemset: 'border-fuchsia-500 bg-fuchsia-500/10',
  concept: 'border-amber-500 bg-amber-500/10',
  passage: 'border-emerald-500 bg-emerald-500/10',
};

const KIND_BADGE_CLASS: Record<BoxKind, string> = {
  problem: 'bg-indigo-600',
  problemset: 'bg-fuchsia-600',
  concept: 'bg-amber-600',
  passage: 'bg-emerald-600',
};

const RENDER_SCALE = 1.5;

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
  captureMode = false,
  onCaptureFigure,
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
  /** 그림 캡처 모드 — 드래그가 박스 생성 대신 영역을 캡처한다. */
  captureMode?: boolean;
  /** 캡처 모드에서 드래그 영역(캔버스 내부 px)을 부모에 넘김. */
  onCaptureFigure?: (rect: BoxRect) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [rendering, setRendering] = useState(false);
  // 드래그(생성/이동/리사이즈) 상태 머신 — 보조 뷰어와 같은 reducer 패턴.
  const [drag, dispatch] = useReducer(boxDragReducer, null);
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
    dispatch({ type: 'createStart', p: pos(e) });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (drag) dispatch({ type: 'drag', p: pos(e), bound: bound() });
  }

  function onMouseUp() {
    if (!drag) return;
    const d = drag;
    dispatch({ type: 'clear' });
    if (d.kind === 'create') {
      if (d.rect.w >= MIN_W && d.rect.h >= MIN_H) {
        if (captureMode) onCaptureFigure?.(d.rect);
        else onCreate(d.rect);
      }
      return;
    }
    // move/resize: 의미 있는 변화가 있으면 커밋
    const moved =
      Math.abs(d.rect.x - d.orig.x) > 1 ||
      Math.abs(d.rect.y - d.orig.y) > 1 ||
      Math.abs(d.rect.w - d.orig.w) > 1 ||
      Math.abs(d.rect.h - d.orig.h) > 1;
    if (moved && d.id) onUpdateRect(d.id, d.rect);
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
              // 캡처 모드에선 박스 위에서도 드래그가 래퍼로 가도록 통과시킨다.
              captureMode && 'pointer-events-none',
            )}
            style={d}
            onMouseDown={(e) => {
              e.stopPropagation();
              onSelect(b.id);
              dispatch({ type: 'moveStart', id: b.id, p: pos(e), rect: b.rect });
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
                    dispatch({ type: 'resizeStart', id: b.id, handle: h, p: pos(e), rect: b.rect });
                  }}
                />
              ))}
          </div>
        );
      })}

      {drag?.kind === 'create' && drag.rect.w > 0 && (
        <div
          className={cn(
            'absolute border-2 border-dashed',
            captureMode ? 'border-violet-500 bg-violet-500/10' : 'border-indigo-500 bg-indigo-500/10',
          )}
          style={toDisplay(drag.rect)}
        />
      )}
    </div>
  );
}
