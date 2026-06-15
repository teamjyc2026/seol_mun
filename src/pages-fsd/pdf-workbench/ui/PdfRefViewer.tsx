'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RotateCcw, RotateCw, ScanText } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { HANDLES, selectionReducer, type Pt, type Rect } from '../lib/dragSelection';

export type RefGrab = {
  /** base64 PNG (데이터URL 헤더 제외) */
  image: string;
  page: number;
  /** 페이지 비율 기준 정규화 좌표 (0–1) — 렌더 스케일 독립 */
  rect: Rect;
};

/**
 * 보조(참조) 뷰어 — 답안지·해설을 옆에 띄워 놓고, 영역을 드래그하면
 * 그 영역 이미지를 부모에게 넘긴다(현재 선택된 문제의 정답·해설 채우기 등).
 * linkedRef가 있으면 해당 박스에 연결된 영역을 표시한다.
 */
export function PdfRefViewer({
  doc,
  rotation = 0,
  grabLabel,
  grabbing,
  onGrab,
  onRotate,
  linkedRefs = [],
}: {
  doc: PDFDocumentProxy;
  /** PDF 회전 (0/90/180/270). */
  rotation?: number;
  grabLabel: string;
  grabbing: boolean;
  onGrab: (grab: RefGrab) => void;
  /** 90° 회전 (좌/우). */
  onRotate?: (delta: 90 | -90) => void;
  /** 선택된 박스의 저장된 답 영역들 (현재 열린 부속 PDF 대상, 다대일) */
  linkedRefs?: { id: string; page: number; rect: Rect }[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [ratio, setRatio] = useState(1);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [sel, dispatch] = useReducer(selectionReducer, { drag: null, rect: null });
  const drag = sel.drag;
  const rect = sel.rect;

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setRendering(true);
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.5, rotation });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport })
          .promise;
        if (!cancelled && canvas.clientWidth > 0) {
          setRatio(canvas.width / canvas.clientWidth);
          setPageSize({ w: canvas.width, h: canvas.height });
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [doc, pageNum, rotation]);

  // 표시 폭이 바뀌면(레이아웃 변화) 비율을 다시 잡아 오버레이가 따라가도록.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      if (canvas.clientWidth > 0) setRatio(canvas.width / canvas.clientWidth);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  /** 페이지 이동 — 드래그 선택은 페이지에 종속이라 함께 초기화. */
  function goPage(n: number) {
    dispatch({ type: 'clear' });
    setPageNum(n);
  }

  function pos(e: React.MouseEvent): Pt {
    const box = wrapRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - box.left, 0), box.width) * ratio,
      y: Math.min(Math.max(e.clientY - box.top, 0), box.height) * ratio,
    };
  }

  function bound(): { w: number; h: number } {
    const c = canvasRef.current;
    return { w: c?.width ?? 0, h: c?.height ?? 0 };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (drag) dispatch({ type: 'drag', p: pos(e), bound: bound() });
  }

  function onMouseUp() {
    if (drag) dispatch({ type: 'end' });
  }

  function grab() {
    const canvas = canvasRef.current;
    if (!canvas || !rect || rect.w < 8) return;
    const crop = document.createElement('canvas');
    crop.width = Math.max(1, Math.round(rect.w));
    crop.height = Math.max(1, Math.round(rect.h));
    crop
      .getContext('2d')!
      .drawImage(canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, crop.width, crop.height);
    const dataUrl = crop.toDataURL('image/png');
    onGrab({
      image: dataUrl.slice(dataUrl.indexOf(',') + 1),
      page: pageNum,
      rect: {
        x: rect.x / canvas.width,
        y: rect.y / canvas.height,
        w: rect.w / canvas.width,
        h: rect.h / canvas.height,
      },
    });
  }

  const toDisplay = (r: Rect) => ({
    left: r.x / ratio,
    top: r.y / ratio,
    width: r.w / ratio,
    height: r.h / ratio,
  });

  /** 정규화(0–1) → 표시 픽셀 */
  const normToDisplay = (r: Rect) => {
    if (!pageSize) return { left: 0, top: 0, width: 0, height: 0 };
    const w = pageSize.w / ratio;
    const h = pageSize.h / ratio;
    return { left: r.x * w, top: r.y * h, width: r.w * w, height: r.h * h };
  };

  return (
    <div className="space-y-2">
      <div className="flex h-8 items-center gap-2 text-sm">
        <button
          type="button"
          disabled={pageNum <= 1}
          onClick={() => goPage(pageNum - 1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-zinc-700">
          {pageNum} / {doc.numPages} p
        </span>
        <button
          type="button"
          disabled={pageNum >= doc.numPages}
          onClick={() => goPage(pageNum + 1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {Array.from(new Set(linkedRefs.filter((l) => l.page !== pageNum).map((l) => l.page)))
          .sort((a, b) => a - b)
          .map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => goPage(p)}
              className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
            >
              연결 p.{p}
            </button>
          ))}
        {onRotate && (
          <>
            <span className="mx-0.5 h-4 w-px bg-zinc-200" />
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'clear' });
                onRotate(-90);
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              title="왼쪽으로 90° 회전"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'clear' });
                onRotate(90);
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              title="오른쪽으로 90° 회전"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          type="button"
          disabled={!rect || rect.w < 8 || grabbing}
          onClick={grab}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {grabbing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ScanText className="h-3.5 w-3.5" />
          )}
          {grabLabel}
        </button>
      </div>
      <div
        ref={wrapRef}
        className="relative inline-block max-w-full cursor-crosshair select-none"
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          dispatch({ type: 'createStart', p: pos(e) });
        }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <canvas
          ref={canvasRef}
          className="block max-w-full rounded-md border border-emerald-200 bg-white"
          style={{ height: 'auto' }}
        />
        {rendering && (
          <div className="absolute inset-0 grid place-items-center bg-white/60">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        )}
        {!rendering &&
          linkedRefs
            .filter((l) => l.page === pageNum)
            .map((l) => (
              <div
                key={l.id}
                data-answer-link
                className="absolute border-2 border-indigo-500 bg-indigo-500/10"
                style={normToDisplay(l.rect)}
              />
            ))}
        {/* 드래그 중 라이브 미리보기 */}
        {drag && (
          <div
            className="absolute border-2 border-emerald-500 bg-emerald-500/15"
            style={toDisplay(drag.rect)}
          />
        )}
        {/* 확정된 선택 영역 — 끌어 옮기거나 모서리로 크기 조절 */}
        {!drag && rect && (
          <div
            className="absolute cursor-move border-2 border-emerald-500 bg-emerald-500/15"
            style={toDisplay(rect)}
            onMouseDown={(e) => {
              e.stopPropagation();
              dispatch({ type: 'moveStart', p: pos(e), rect });
            }}
          >
            {HANDLES.map(({ h, cls, cursor }) => (
              <span
                key={h}
                className={`absolute h-2.5 w-2.5 rounded-full border border-white bg-emerald-600 ${cls}`}
                style={{ cursor }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'resizeStart', p: pos(e), handle: h, rect });
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
