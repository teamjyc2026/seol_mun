'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Lightbulb,
  Loader2,
  PencilLine,
  Save,
  Scissors,
} from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { School } from '@/entities/school';
import { api } from '@/shared/api/axios';
import { SUBJECTS, type Subject } from '@/shared/config/subjects';
import { cn } from '@/shared/lib/cn';
import { createProblem } from '@/features/create-problem';
import {
  PdfBoxViewer,
  KIND_LABEL,
  type BoxKind,
  type BoxRect,
  type WorkBox,
} from './PdfBoxViewer';
import { TopicPicker } from './TopicPicker';
import {
  WorkbenchProblemForm,
  emptyProblemValue,
  type WorkbenchProblemValue,
} from './WorkbenchProblemForm';

const SOURCE_TYPES = ['교과서', '문제집', '기출', '요약본', '강의자료', '기타'];
const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];

type OcrProblem = {
  passage?: string;
  question: string;
  choices?: { label: string; text: string }[];
  answer?: string;
  explanation?: string;
  problem_type: 'objective' | 'short' | 'long';
  topic?: string;
};

type ChunkValue = {
  category: string | null;
  topic: string;
  text: string;
};

type BoxData = WorkBox & {
  problem: WorkbenchProblemValue;
  chunk: ChunkValue;
};

type SourceInfo = { id: string; title: string; subject: string };

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  return pdfjs;
}

const KIND_ICON: Record<BoxKind, typeof PencilLine> = {
  problem: PencilLine,
  concept: Lightbulb,
  passage: BookOpen,
};

export function PdfWorkbenchPage({ schools }: { schools: School[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ---- 시작 화면 (소스 메타데이터) ----
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<Subject>('영어');
  const [grade, setGrade] = useState('고1');
  const [sourceType, setSourceType] = useState('문제집');
  const [publisher, setPublisher] = useState('');
  const [schoolId, setSchoolId] = useState<string | null>(schools[0]?.id ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  // ---- 작업 화면 ----
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [drawKind, setDrawKind] = useState<BoxKind>('problem');
  const [boxes, setBoxes] = useState<BoxData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = boxes.find((b) => b.id === selectedId) ?? null;

  function pickFile(file: File) {
    setPendingFile(file);
    if (!title) setTitle(file.name.replace(/\.pdf$/i, '').normalize('NFC'));
  }

  /** 시작: Storage 업로드 + sources 등록(워크벤치 모드) + 뷰어 오픈 */
  async function start() {
    if (!pendingFile || uploading) return;
    if (!title.trim()) {
      toast.error('제목을 입력해 주세요.');
      return;
    }
    setUploading(true);
    try {
      // 1) 서명 URL 발급 → 브라우저에서 Storage로 직접 업로드
      const { data: signed } = await api.post<{
        id: string;
        path: string;
        signedUrl: string;
      }>('/agent/sources/upload-url', {
        filename: pendingFile.name,
        size: pendingFile.size,
      });
      await axios.put(signed.signedUrl, pendingFile, {
        headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
        timeout: 600_000,
        onUploadProgress: (e) => {
          if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100));
        },
      });

      // 2) 워크벤치 모드 등록 (자동 인덱싱 없음)
      const { data } = await api.post<{ id: string }>('/agent/sources', {
        path: signed.path,
        original_filename: pendingFile.name.normalize('NFC'),
        file_size_bytes: pendingFile.size,
        title: title.trim(),
        source_type: sourceType,
        subject,
        subjects: [subject],
        grade,
        publisher: publisher.trim() || undefined,
        school_id: schoolId,
        mode: 'workbench',
      });

      // 3) 뷰어 오픈
      const pdfjs = await loadPdfjs();
      const buf = await pendingFile.arrayBuffer();
      const loaded = await pdfjs.getDocument({ data: buf }).promise;
      setDoc(loaded);
      setNumPages(loaded.numPages);
      setPageNum(1);
      setSource({ id: data.id, title: title.trim(), subject });
      toast.success('교재로 등록됐어요. 이제 영역을 드래그하세요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setUploading(false);
    }
  }

  function patchBox(id: string, patch: Partial<BoxData>) {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function cropToBase64(rect: BoxRect): string | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const crop = document.createElement('canvas');
    crop.width = Math.max(1, Math.round(rect.w));
    crop.height = Math.max(1, Math.round(rect.h));
    crop
      .getContext('2d')!
      .drawImage(canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, crop.width, crop.height);
    const dataUrl = crop.toDataURL('image/png');
    return dataUrl.slice(dataUrl.indexOf(',') + 1);
  }

  /** 박스 생성 → 종류별 OCR → 폼 채우기 */
  async function onCreate(rect: BoxRect) {
    const id = crypto.randomUUID();
    const kind = drawKind;
    const box: BoxData = {
      id,
      page: pageNum,
      rect,
      kind,
      status: 'ocr',
      problem: emptyProblemValue(),
      chunk: { category: null, topic: '', text: '' },
    };
    setBoxes((prev) => [...prev, box]);
    setSelectedId(id);

    try {
      const image = cropToBase64(rect);
      if (!image) throw new Error('캔버스를 읽을 수 없어요.');

      if (kind === 'problem') {
        const res = await fetch('/api/agent/ocr/problem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, mediaType: 'image/png' }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '인식 실패');
        const { problem } = (await res.json()) as { problem: OcrProblem };
        patchBox(id, {
          status: 'ready',
          problem: {
            ...box.problem,
            problem_type: problem.problem_type,
            topic: problem.topic ?? '',
            passage: problem.passage ?? '',
            question: problem.question,
            choices: problem.choices?.length ? problem.choices : box.problem.choices,
            answer: problem.answer ?? '',
            explanation: problem.explanation ?? '',
          },
        });
      } else {
        const res = await fetch('/api/agent/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, mediaType: 'image/png' }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '인식 실패');
        const { text } = (await res.json()) as { text: string };
        patchBox(id, { status: 'ready', chunk: { ...box.chunk, text } });
      }
    } catch (e) {
      patchBox(id, { status: 'failed' });
      toast.error(e instanceof Error ? e.message : '인식 실패');
    }
  }

  async function saveSelected() {
    if (!selected || !source || saving) return;
    setSaving(true);
    try {
      if (selected.kind === 'problem') {
        const f = selected.problem;
        if (!f.question.trim() || !f.answer.trim()) {
          toast.error('발문과 정답을 채워주세요.');
          return;
        }
        const { id } = await createProblem({
          subject: source.subject,
          topic: f.topic || null,
          difficulty: f.difficulty,
          problem_type: f.problem_type,
          passage: f.passage.trim() || null,
          question: f.question,
          choices:
            f.problem_type === 'objective'
              ? f.choices.filter((c) => c.text.trim())
              : null,
          answer: f.answer,
          explanation: f.explanation || null,
          notes: 'PDF 워크벤치 등록',
          citations: [
            {
              sourceId: source.id,
              sourceTitle: source.title,
              page: selected.page,
              snippet: (f.passage || f.question).slice(0, 160),
            },
          ],
        });
        await api.post(`/agent/problems/${id}/embed`).catch(() => {
          toast.info('저장됐지만 임베딩 실패 — 문제 목록 ⚡로 재시도하세요.');
        });
        toast.success('문제 저장 + 임베딩 완료');
      } else {
        const c = selected.chunk;
        if (c.text.trim().length < 10) {
          toast.error('내용이 너무 짧아요 (10자 이상).');
          return;
        }
        const chapterPath = [
          KIND_LABEL[selected.kind],
          ...(c.category ? [c.category] : []),
          ...(c.topic ? [c.topic] : []),
        ];
        await api.post(`/agent/sources/${source.id}/chunks`, {
          page_number: selected.page,
          content: c.text,
          chapter_path: chapterPath,
        });
        toast.success(`${KIND_LABEL[selected.kind]} 청크 저장 + 임베딩 완료`);
      }
      patchBox(selected.id, { status: 'saved' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  const pageBoxCount = boxes.filter((b) => b.page === pageNum).length;
  const savedCount = boxes.filter((b) => b.status === 'saved').length;

  // ---------------- 시작 화면 ----------------
  if (!doc || !source) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <header className="mb-4 flex items-center gap-2">
          <Scissors className="h-5 w-5 text-zinc-700" />
          <h1 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
            PDF 워크벤치
          </h1>
          <p className="ml-1 text-xs text-zinc-500">
            PDF 하나로 문제·개념·본문을 영역 단위로 등록하는 통합 도구
          </p>
        </header>

        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div
            className={cn(
              'grid h-28 cursor-pointer place-items-center rounded-xl border-2 border-dashed text-sm',
              pendingFile
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-zinc-300 text-zinc-400',
            )}
            onClick={() => fileRef.current?.click()}
          >
            {pendingFile ? (
              <span className="flex items-center gap-2">
                <FileUp className="h-4 w-4" /> {pendingFile.name}
              </span>
            ) : (
              '여기를 클릭해서 PDF 선택'
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f);
              e.target.value = '';
            }}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 천재 영어 평가문제집 Lesson 3"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700">과목</label>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubject(s)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                    subject === s
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700">학년</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700">자료 유형</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700">출판사</label>
              <input
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="예) 천재교육"
                className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700">학교</label>
              <select
                value={schoolId ?? ''}
                onChange={(e) => setSchoolId(e.target.value || null)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
              >
                <option value="">배정 안 함</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void start()}
            disabled={!pendingFile || uploading}
            className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {uploading ? `업로드 중… ${uploadPct}%` : '업로드하고 작업 시작'}
          </button>
        </div>
      </main>
    );
  }

  // ---------------- 작업 화면 ----------------
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Scissors className="h-5 w-5 text-zinc-700" />
        <h1 className="text-base font-bold tracking-tight text-zinc-900">{source.title}</h1>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">
          {source.subject}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-xs text-zinc-500">새 박스:</span>
          {(Object.keys(KIND_LABEL) as BoxKind[]).map((k) => {
            const Icon = KIND_ICON[k];
            const active = drawKind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setDrawKind(k)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition',
                  active
                    ? k === 'problem'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : k === 'concept'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {KIND_LABEL[k]}
              </button>
            );
          })}
        </div>
      </header>

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
            <span className="ml-auto text-xs text-zinc-500">
              이 페이지 {pageBoxCount}개 · 저장 {savedCount}/{boxes.length}
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

        {/* 오른쪽: 박스 편집 패널 */}
        <section className="space-y-3">
          {!selected ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
              종류(문제/개념/본문)를 고르고 왼쪽에서 영역을 드래그하세요.
              <br />
              박스를 클릭하면 여기서 수정할 수 있어요.
            </div>
          ) : selected.status === 'ocr' ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> {KIND_LABEL[selected.kind]} 영역
              인식 중…
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
                <span className="flex items-center gap-2">
                  p.{selected.page} · {KIND_LABEL[selected.kind]}
                  <select
                    value={selected.kind}
                    onChange={(e) =>
                      patchBox(selected.id, { kind: e.target.value as BoxKind })
                    }
                    disabled={selected.status === 'saved'}
                    className="rounded border border-zinc-200 bg-white px-1 py-0.5 text-[11px]"
                    title="박스 종류 변경"
                  >
                    {(Object.keys(KIND_LABEL) as BoxKind[]).map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  {selected.status === 'saved'
                    ? '저장됨 ✓'
                    : selected.status === 'failed'
                      ? '인식 실패 — 직접 입력 가능'
                      : ''}
                </span>
                <button
                  type="button"
                  onClick={() => void saveSelected()}
                  disabled={saving || selected.status === 'saved'}
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  저장
                </button>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                {selected.kind === 'problem' ? (
                  <WorkbenchProblemForm
                    subject={source.subject}
                    value={selected.problem}
                    onChange={(next) => patchBox(selected.id, { problem: next })}
                  />
                ) : (
                  <div className="space-y-4">
                    <TopicPicker
                      subject={source.subject}
                      category={selected.chunk.category}
                      value={selected.chunk.topic}
                      onChange={({ category, topic }) =>
                        patchBox(selected.id, {
                          chunk: { ...selected.chunk, category, topic },
                        })
                      }
                    />
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-700">
                        {KIND_LABEL[selected.kind]} 내용 (인식 결과 — 수정 가능)
                      </label>
                      <textarea
                        value={selected.chunk.text}
                        onChange={(e) =>
                          patchBox(selected.id, {
                            chunk: { ...selected.chunk, text: e.target.value },
                          })
                        }
                        rows={14}
                        className="block w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
