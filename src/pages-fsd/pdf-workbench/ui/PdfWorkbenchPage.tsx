'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Loader2,
  Save,
  Scissors,
} from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Source } from '@/entities/source';
import { api } from '@/shared/api/axios';
import { cn } from '@/shared/lib/cn';
import {
  emptyValue,
  ProblemForm,
  type ProblemFormValue,
} from '@/widgets/problem-editor';
import { createProblem } from '@/features/create-problem';
import { PdfBoxViewer, type BoxRect, type WorkBox } from './PdfBoxViewer';

type OcrProblem = {
  passage?: string;
  question: string;
  choices?: { label: string; text: string }[];
  answer?: string;
  explanation?: string;
  problem_type: 'objective' | 'short' | 'long';
  topic?: string;
};

type BoxData = WorkBox & {
  form: ProblemFormValue;
  passage: string;
};

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  return pdfjs;
}

export function PdfWorkbenchPage({ sources }: { sources: Source[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState('');
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [boxes, setBoxes] = useState<BoxData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [defaultSourceId, setDefaultSourceId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const selected = boxes.find((b) => b.id === selectedId) ?? null;

  async function openFile(file: File) {
    try {
      const pdfjs = await loadPdfjs();
      const buf = await file.arrayBuffer();
      const loaded = await pdfjs.getDocument({ data: buf }).promise;
      setDoc(loaded);
      setFileName(file.name);
      setNumPages(loaded.numPages);
      setPageNum(1);
      setBoxes([]);
      setSelectedId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF를 열 수 없어요.');
    }
  }

  function patchBox(id: string, patch: Partial<BoxData>) {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  /** 박스 생성 → 영역 크롭 → 구조화 OCR → 폼 채우기 */
  async function onCreate(rect: BoxRect) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = crypto.randomUUID();
    const src = sources.find((s) => s.id === defaultSourceId);
    const base = emptyValue();
    const box: BoxData = {
      id,
      page: pageNum,
      rect,
      status: 'ocr',
      passage: '',
      form: {
        ...base,
        citations: src
          ? [{ sourceId: src.id, sourceTitle: src.title, page: pageNum, snippet: '' }]
          : [],
      },
    };
    setBoxes((prev) => [...prev, box]);
    setSelectedId(id);

    try {
      const crop = document.createElement('canvas');
      crop.width = Math.max(1, Math.round(rect.w));
      crop.height = Math.max(1, Math.round(rect.h));
      crop
        .getContext('2d')!
        .drawImage(canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, crop.width, crop.height);
      const dataUrl = crop.toDataURL('image/png');
      const image = dataUrl.slice(dataUrl.indexOf(',') + 1);

      const res = await fetch('/api/agent/ocr/problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, mediaType: 'image/png' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? '인식 실패');
      }
      const { problem } = (await res.json()) as { problem: OcrProblem };
      patchBox(id, {
        status: 'ready',
        passage: problem.passage ?? '',
        form: {
          ...box.form,
          problem_type: problem.problem_type,
          topic: problem.topic ?? '',
          question: problem.question,
          choices: problem.choices?.length
            ? problem.choices
            : problem.problem_type === 'objective'
              ? box.form.choices
              : [],
          answer: problem.answer ?? '',
          explanation: problem.explanation ?? '',
        },
      });
    } catch (e) {
      patchBox(id, { status: 'failed' });
      toast.error(e instanceof Error ? e.message : '인식 실패');
    }
  }

  async function saveSelected() {
    if (!selected || saving) return;
    const f = selected.form;
    if (!f.question.trim() || !f.answer.trim()) {
      toast.error('질문과 정답을 채워주세요.');
      return;
    }
    setSaving(true);
    try {
      const { id } = await createProblem({
        subject: f.subject,
        topic: f.topic || null,
        difficulty: (f.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
        problem_type: f.problem_type,
        passage: selected.passage.trim() || null,
        question: f.question,
        choices: f.problem_type === 'objective' ? f.choices.filter((c) => c.text.trim()) : null,
        answer: f.answer,
        explanation: f.explanation || null,
        notes: f.notes || 'PDF 워크벤치 등록',
        citations: f.citations,
      });
      // 바로 검색되도록 임베딩까지
      await api.post(`/agent/problems/${id}/embed`).catch(() => {
        toast.info('저장됐지만 임베딩은 실패 — 문제 목록에서 ⚡로 재시도하세요.');
      });
      patchBox(selected.id, { status: 'saved' });
      toast.success('문제 저장 + 임베딩 완료');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  const pageBoxCount = boxes.filter((b) => b.page === pageNum).length;
  const savedCount = boxes.filter((b) => b.status === 'saved').length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/agent/problems"
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 문제 목록
        </Link>
        <h1 className="flex items-center gap-2 text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
          <Scissors className="h-5 w-5 text-zinc-700" /> PDF 문제 추출
        </h1>
        <p className="text-xs text-zinc-500">
          왼쪽에서 문제 영역을 드래그하면 → 오른쪽에 인식된 문제가 떠요. 수정 후 저장.
        </p>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={defaultSourceId}
            onChange={(e) => setDefaultSourceId(e.target.value)}
            className="h-8 max-w-56 rounded-md border border-zinc-200 bg-white px-2 text-xs"
            title="새 박스에 자동으로 출처가 연결됩니다"
          >
            <option value="">출처 책 선택 (선택)</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white"
          >
            <FileUp className="h-3.5 w-3.5" /> PDF 열기
          </button>
        </div>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void openFile(f);
          e.target.value = '';
        }}
      />

      {!doc ? (
        <div
          className="grid h-80 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-zinc-300 bg-white text-sm text-zinc-400"
          onClick={() => fileRef.current?.click()}
        >
          여기를 클릭해서 시험지 PDF를 여세요 (업로드 없이 브라우저에서만 열립니다)
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_440px]">
          {/* 왼쪽: 뷰어 */}
          <section className="space-y-2">
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
                {pageNum} / {numPages} p
              </span>
              <button
                type="button"
                disabled={pageNum >= numPages}
                onClick={() => setPageNum((p) => p + 1)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="ml-2 truncate text-xs text-zinc-400">{fileName}</span>
              <span className="ml-auto text-xs text-zinc-500">
                이 페이지 박스 {pageBoxCount}개 · 저장 {savedCount}/{boxes.length}
              </span>
            </div>
            <PdfBoxViewer
              doc={doc}
              pageNum={pageNum}
              boxes={boxes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDelete={(id) => {
                setBoxes((prev) => prev.filter((b) => b.id !== id));
                if (selectedId === id) setSelectedId(null);
              }}
              onCreate={(r) => void onCreate(r)}
              canvasRef={canvasRef}
            />
          </section>

          {/* 오른쪽: 문제 폼 */}
          <section className="space-y-3">
            {!selected ? (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
                왼쪽에서 문제 영역을 드래그하거나 박스를 클릭하세요.
              </div>
            ) : selected.status === 'ocr' ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> 영역 글자 인식 중…
              </div>
            ) : (
              <>
                <div
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium',
                    selected.status === 'saved'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : selected.status === 'failed'
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-zinc-200 bg-white text-zinc-600',
                  )}
                >
                  <span>
                    p.{selected.page} 박스 —{' '}
                    {selected.status === 'saved'
                      ? '저장됨 ✓'
                      : selected.status === 'failed'
                        ? '인식 실패 (직접 입력 가능)'
                        : '인식 완료, 검토 후 저장하세요'}
                  </span>
                  <button
                    type="button"
                    onClick={saveSelected}
                    disabled={saving || selected.status === 'saved'}
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    이 문제 저장
                  </button>
                </div>

                <div className="space-y-1.5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <label className="text-xs font-medium text-zinc-700">지문 (선택)</label>
                  <textarea
                    value={selected.passage}
                    onChange={(e) => patchBox(selected.id, { passage: e.target.value })}
                    rows={5}
                    placeholder="공유 지문이 있으면 여기에 (없으면 비워두세요)"
                    className="block w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none"
                  />
                </div>

                <ProblemForm
                  value={selected.form}
                  onChange={(next) => patchBox(selected.id, { form: next })}
                  sources={sources}
                />
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
