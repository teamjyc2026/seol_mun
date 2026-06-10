'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, Loader2, ScanText, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

type Rect = { x: number; y: number; w: number; h: number };

/**
 * 이미지 붙여넣기(Ctrl+V)/선택 → 드래그로 영역 크롭 → Claude OCR로 글자 인식.
 * 인식된 텍스트는 onText로 전달된다 (문제·해설·교재 본문 입력용).
 */
export function ImageCropOcr({
  onText,
  label = '이미지에서 글자 인식 (붙여넣기 · 크롭)',
}: {
  onText: (text: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImgSrc(reader.result as string);
      setRect(null);
    };
    reader.readAsDataURL(file);
  }, []);

  function onPaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith('image/'),
    );
    const file = item?.getAsFile();
    if (file) {
      e.preventDefault();
      loadFile(file);
    }
  }

  function pos(e: React.MouseEvent): { x: number; y: number } {
    const box = boxRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - box.left, 0), box.width),
      y: Math.min(Math.max(e.clientY - box.top, 0), box.height),
    };
  }

  function onMouseDown(e: React.MouseEvent) {
    if (!imgSrc) return;
    const p = pos(e);
    setDragStart(p);
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragStart) return;
    const p = pos(e);
    setRect({
      x: Math.min(dragStart.x, p.x),
      y: Math.min(dragStart.y, p.y),
      w: Math.abs(p.x - dragStart.x),
      h: Math.abs(p.y - dragStart.y),
    });
  }
  function onMouseUp() {
    setDragStart(null);
    if (rect && (rect.w < 8 || rect.h < 8)) setRect(null);
  }

  async function recognize(cropOnly: boolean) {
    const img = imgRef.current;
    if (!img || busy) return;
    setBusy(true);
    try {
      // 화면 좌표 → 원본 픽셀 좌표
      const scaleX = img.naturalWidth / img.clientWidth;
      const scaleY = img.naturalHeight / img.clientHeight;
      const sel: Rect =
        cropOnly && rect && rect.w >= 8 && rect.h >= 8
          ? {
              x: rect.x * scaleX,
              y: rect.y * scaleY,
              w: rect.w * scaleX,
              h: rect.h * scaleY,
            }
          : { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sel.w));
      canvas.height = Math.max(1, Math.round(sel.h));
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, sel.x, sel.y, sel.w, sel.h, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);

      const res = await fetch('/api/agent/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/png' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? '인식 실패');
      }
      const { text } = (await res.json()) as { text: string };
      if (!text) {
        toast.info('인식된 글자가 없어요.');
        return;
      }
      onText(text);
      toast.success('글자를 인식해서 넣었어요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '인식 실패');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
      >
        <Camera className="h-3.5 w-3.5" /> {label}
      </button>
    );
  }

  return (
    <div
      className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
      onPaste={onPaste}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-600">
          📷 스크린샷을 <b>Ctrl+V(⌘V)</b>로 붙여넣고, 마우스로 인식할 영역을 드래그하세요.
        </p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setImgSrc(null);
            setRect(null);
          }}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!imgSrc ? (
        <div
          tabIndex={0}
          className="grid h-28 cursor-pointer place-items-center rounded-md border-2 border-dashed border-zinc-300 bg-white text-xs text-zinc-400 outline-none focus:border-indigo-400"
          onClick={() => fileRef.current?.click()}
        >
          여기를 클릭(포커스)한 뒤 Ctrl+V — 또는 클릭해서 이미지 선택
        </div>
      ) : (
        <div
          ref={boxRef}
          className="relative inline-block max-w-full cursor-crosshair select-none"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imgSrc}
            alt="OCR 대상"
            className="max-h-96 max-w-full rounded-md border border-zinc-200"
            draggable={false}
          />
          {rect && rect.w > 0 && (
            <div
              className="absolute border-2 border-indigo-500 bg-indigo-500/15"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            />
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFile(f);
          e.target.value = '';
        }}
      />

      {imgSrc && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={busy || !rect || rect.w < 8}
            onClick={() => recognize(true)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40',
            )}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanText className="h-3.5 w-3.5" />}
            선택 영역 인식
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => recognize(false)}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 disabled:opacity-40"
          >
            전체 인식
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setImgSrc(null);
              setRect(null);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 disabled:opacity-40"
          >
            다른 이미지
          </button>
        </div>
      )}
    </div>
  );
}
