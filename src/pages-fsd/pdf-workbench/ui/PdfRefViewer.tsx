'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, ScanText } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

type Rect = { x: number; y: number; w: number; h: number };

/**
 * 보조(참조) 뷰어 — 답안지·해설을 옆에 띄워 놓고, 영역을 드래그하면
 * 그 영역 이미지를 부모에게 넘긴다(현재 선택된 문제의 정답·해설 채우기 등).
 * 박스를 영속하지 않는 가벼운 뷰어.
 */
export function PdfRefViewer({
  doc,
  grabLabel,
  grabbing,
  onGrab,
}: {
  doc: PDFDocumentProxy;
  grabLabel: string;
  grabbing: boolean;
  /** base64 PNG (데이터URL 헤더 제외) */
  onGrab: (imageBase64: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [ratio, setRatio] = useState(1);
  const [drag, setDrag] = useState<{ start: { x: number; y: number }; rect: Rect } | null>(
    null,
  );
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setRendering(true);
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport })
          .promise;
        if (!cancelled && canvas.clientWidth > 0) {
          setRatio(canvas.width / canvas.clientWidth);
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }
    setRect(null);
    void render();
    return () => {
      cancelled = true;
    };
  }, [doc, pageNum]);

  function pos(e: React.MouseEvent): { x: number; y: number } {
    const box = wrapRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - box.left, 0), box.width) * ratio,
      y: Math.min(Math.max(e.clientY - box.top, 0), box.height) * ratio,
    };
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
    onGrab(dataUrl.slice(dataUrl.indexOf(',') + 1));
  }

  const toDisplay = (r: Rect) => ({
    left: r.x / ratio,
    top: r.y / ratio,
    width: r.w / ratio,
    height: r.h / ratio,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          disabled={pageNum <= 1}
          onClick={() => setPageNum((p) => p - 1)}
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
          onClick={() => setPageNum((p) => p + 1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
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
          const p = pos(e);
          setDrag({ start: p, rect: { x: p.x, y: p.y, w: 0, h: 0 } });
          setRect(null);
        }}
        onMouseMove={(e) => {
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
        }}
        onMouseUp={() => {
          if (drag) setRect(drag.rect.w >= 8 ? drag.rect : null);
          setDrag(null);
        }}
        onMouseLeave={() => {
          if (drag) setRect(drag.rect.w >= 8 ? drag.rect : null);
          setDrag(null);
        }}
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
        {(drag?.rect ?? rect) && (
          <div
            className="absolute border-2 border-emerald-500 bg-emerald-500/15"
            style={toDisplay((drag?.rect ?? rect)!)}
          />
        )}
      </div>
    </div>
  );
}
