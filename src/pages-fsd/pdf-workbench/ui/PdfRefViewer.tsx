'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  RotateCcw,
  RotateCw,
  ScanText,
} from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { cn } from '@/shared/lib/cn';
import { HANDLES, boxDragReducer, selectionReducer, type Pt, type Rect } from '../lib/dragSelection';

/** 보조 뷰어 grab 모드 — 정답·해설 OCR / 그림(이미지) 추가. */
export type RefGrabMode = 'answer' | 'figure';

export type RefGrab = {
  /** base64 이미지 (데이터URL 헤더 제외) — answer=PNG, figure=JPEG(압축) */
  image: string;
  page: number;
  /** 페이지 비율 기준 정규화 좌표 (0–1) — 렌더 스케일 독립 */
  rect: Rect;
  mode: RefGrabMode;
};

/**
 * 보조(참조) 뷰어 — 답안지·해설을 옆에 띄워 놓고, 영역을 드래그하면
 * 그 영역 이미지를 부모에게 넘긴다(현재 선택된 문제의 정답·해설 채우기 등).
 * linkedRef가 있으면 해당 박스에 연결된 영역을 표시한다.
 */
export function PdfRefViewer({
  doc,
  pageRotations = {},
  grabLabel,
  grabbing,
  onGrab,
  onRotate,
  onReset,
  linkedRefs = [],
  onUpdateLinkedRef,
}: {
  doc: PDFDocumentProxy;
  /** 페이지별 회전 맵(메타데이터). 현재 페이지 회전은 여기서 해석. */
  pageRotations?: Record<number, number>;
  grabLabel: string;
  grabbing: boolean;
  onGrab: (grab: RefGrab) => void;
  /** 90° 회전 (좌/우) — 현재 보는 페이지를 함께 넘긴다(페이지별 회전). */
  onRotate?: (delta: 90 | -90, page: number) => void;
  /** 전 페이지 회전 0으로 초기화. */
  onReset?: () => void;
  /** 선택된 박스의 저장된 답 영역들 (현재 열린 부속 PDF 대상, 다대일) */
  linkedRefs?: { id: string; page: number; rect: Rect }[];
  /** 연결된 답 영역을 재선택·이동·리사이즈했을 때 (rect는 정규화 0–1). */
  onUpdateLinkedRef?: (refId: string, rect: Rect) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [ratio, setRatio] = useState(1);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [sel, dispatch] = useReducer(selectionReducer, { drag: null, rect: null });
  const [mode, setMode] = useState<RefGrabMode>('answer');
  // 연결된 답 영역 재선택·이동·리사이즈 (id 기반, 캔버스 px).
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [linkDrag, linkDispatch] = useReducer(boxDragReducer, null);
  const drag = sel.drag;
  const rect = sel.rect;
  const rotation = pageRotations[pageNum] ?? 0;

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
    linkDispatch({ type: 'clear' });
    setSelectedLinkId(null);
    setPageNum(n);
  }

  /** 정규화(0–1) ↔ 캔버스 내부 px (연결 영역 편집용). */
  function normToPx(r: Rect): Rect {
    const c = canvasRef.current;
    const w = c?.width ?? 0;
    const h = c?.height ?? 0;
    return { x: r.x * w, y: r.y * h, w: r.w * w, h: r.h * h };
  }
  function pxToNorm(r: Rect): Rect {
    const c = canvasRef.current;
    const w = c?.width || 1;
    const h = c?.height || 1;
    return { x: r.x / w, y: r.y / h, w: r.w / w, h: r.h / h };
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
    else if (linkDrag) linkDispatch({ type: 'drag', p: pos(e), bound: bound() });
  }

  function onMouseUp() {
    if (drag) dispatch({ type: 'end' });
    if (linkDrag) {
      const d = linkDrag;
      linkDispatch({ type: 'clear' });
      if (d.kind !== 'create' && d.id) {
        const moved =
          Math.abs(d.rect.x - d.orig.x) > 1 ||
          Math.abs(d.rect.y - d.orig.y) > 1 ||
          Math.abs(d.rect.w - d.orig.w) > 1 ||
          Math.abs(d.rect.h - d.orig.h) > 1;
        if (moved) onUpdateLinkedRef?.(d.id, pxToNorm(d.rect));
      }
    }
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
    // 그림은 저장·전송용이라 JPEG로 압축, 정답·해설 OCR은 선명한 PNG.
    const dataUrl =
      mode === 'figure' ? crop.toDataURL('image/jpeg', 0.85) : crop.toDataURL('image/png');
    onGrab({
      image: dataUrl.slice(dataUrl.indexOf(',') + 1),
      page: pageNum,
      rect: {
        x: rect.x / canvas.width,
        y: rect.y / canvas.height,
        w: rect.w / canvas.width,
        h: rect.h / canvas.height,
      },
      mode,
    });
  }

  const toDisplay = (r: Rect) => ({
    left: r.x / ratio,
    top: r.y / ratio,
    width: r.w / ratio,
    height: r.h / ratio,
  });

  /** 정규화(0–1) → 표시 픽셀 (렌더용 — ref 대신 pageSize 상태 사용). */
  const normToDisplay = (r: Rect) => {
    if (!pageSize) return { left: 0, top: 0, width: 0, height: 0 };
    const w = pageSize.w / ratio;
    const h = pageSize.h / ratio;
    return { left: r.x * w, top: r.y * h, width: r.w * w, height: r.h * h };
  };

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
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
              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
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
                onRotate(-90, pageNum);
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              title="이 페이지만 왼쪽으로 90° 회전"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'clear' });
                onRotate(90, pageNum);
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              title="이 페이지만 오른쪽으로 90° 회전"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-zinc-200 px-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50"
                title="이 PDF의 모든 페이지 회전을 0°로 되돌림"
              >
                초기화
              </button>
            )}
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {/* 가져오기 모드 — 정답·해설 OCR / 그림 추가 */}
          <div className="flex rounded-md border border-zinc-200 p-0.5">
            <button
              type="button"
              onClick={() => setMode('answer')}
              className={cn(
                'rounded px-1.5 py-1 text-[11px] font-medium',
                mode === 'answer' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:bg-zinc-50',
              )}
            >
              정답·해설
            </button>
            <button
              type="button"
              onClick={() => setMode('figure')}
              className={cn(
                'rounded px-1.5 py-1 text-[11px] font-medium',
                mode === 'figure' ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:bg-zinc-50',
              )}
            >
              그림
            </button>
          </div>
          <button
            type="button"
            disabled={!rect || rect.w < 8 || grabbing}
            onClick={grab}
            className={cn(
              'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40',
              mode === 'figure' ? 'bg-violet-600' : 'bg-emerald-600',
            )}
          >
            {grabbing ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : mode === 'figure' ? (
              <ImagePlus className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ScanText className="h-3.5 w-3.5 shrink-0" />
            )}
            {mode === 'figure' ? '그림 가져오기' : grabLabel}
          </button>
        </div>
      </div>
      <div
        ref={wrapRef}
        className="relative inline-block max-w-full cursor-crosshair select-none"
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          setSelectedLinkId(null);
          linkDispatch({ type: 'clear' });
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
            .map((l) => {
              const isSel = selectedLinkId === l.id;
              // 이 연결을 드래그 중이면 라이브 px(toDisplay), 아니면 저장된 정규화(normToDisplay).
              const dragging =
                linkDrag !== null && linkDrag.kind !== 'create' && linkDrag.id === l.id;
              const style = dragging ? toDisplay(linkDrag.rect) : normToDisplay(l.rect);
              return (
                <div
                  key={l.id}
                  data-answer-link
                  className={cn(
                    'absolute cursor-move border-2 border-emerald-600 bg-emerald-600/10',
                    isSel && 'ring-2 ring-emerald-700/60',
                  )}
                  style={style}
                  title="끌어 옮기거나 모서리로 크기 조절"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setSelectedLinkId(l.id);
                    linkDispatch({ type: 'moveStart', id: l.id, p: pos(e), rect: normToPx(l.rect) });
                  }}
                >
                  {isSel &&
                    HANDLES.map(({ h, cls, cursor }) => (
                      <span
                        key={h}
                        className={cn(
                          'absolute h-2.5 w-2.5 rounded-full border border-white bg-emerald-700',
                          cls,
                        )}
                        style={{ cursor }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          linkDispatch({
                            type: 'resizeStart',
                            id: l.id,
                            handle: h,
                            p: pos(e),
                            rect: normToPx(l.rect),
                          });
                        }}
                      />
                    ))}
                </div>
              );
            })}
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
            className={cn(
              'absolute cursor-move border-2 bg-emerald-500/15',
              mode === 'figure' ? 'border-violet-500' : 'border-emerald-500',
            )}
            style={toDisplay(rect)}
            onMouseDown={(e) => {
              e.stopPropagation();
              dispatch({ type: 'moveStart', p: pos(e), rect });
            }}
          >
            {/* 영역 위 가져오기 버튼 — 드래그한 자리에서 바로 실행 */}
            <button
              type="button"
              disabled={grabbing}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                grab();
              }}
              className={cn(
                'absolute -top-7 right-0 inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-white shadow disabled:opacity-50',
                mode === 'figure' ? 'bg-violet-600' : 'bg-emerald-600',
              )}
            >
              {grabbing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : mode === 'figure' ? (
                <ImagePlus className="h-3 w-3" />
              ) : (
                <ScanText className="h-3 w-3" />
              )}
              {mode === 'figure' ? '그림' : '정답·해설'}
            </button>
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
