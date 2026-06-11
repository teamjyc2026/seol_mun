'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  FileUp,
  Lightbulb,
  Loader2,
  PencilLine,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Trash2,
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
import { PdfRefViewer } from './PdfRefViewer';
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

type ChunkValue = { category: string | null; topic: string; text: string };

type BoxPayload = { problem?: WorkbenchProblemValue; chunk?: ChunkValue };

type BoxData = WorkBox & {
  problem: WorkbenchProblemValue;
  chunk: ChunkValue;
};

type JobSummary = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  hasAnswerPdf: boolean;
  boxCount: number;
  savedCount: number;
  updated_at: string;
};

type JobDetail = {
  job: { id: string; title: string; hasAnswerPdf: boolean };
  source: { id: string; title: string; subject: string; grade: string | null };
  pdfUrl: string;
  answerPdfUrl: string | null;
  boxes: {
    id: string;
    page: number;
    rect: BoxRect;
    kind: BoxKind;
    status: WorkBox['status'];
    payload: BoxPayload;
  }[];
};

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  return pdfjs;
}

async function loadPdfFromUrl(url: string): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  const { data } = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
  return pdfjs.getDocument({ data }).promise;
}

const KIND_ICON: Record<BoxKind, typeof PencilLine> = {
  problem: PencilLine,
  concept: Lightbulb,
  passage: BookOpen,
};

export function PdfWorkbenchPage({ schools }: { schools: School[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const answerFileRef = useRef<HTMLInputElement | null>(null);
  const patchTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ---- 목록 / 새 작업 ----
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [source, setSource] = useState<JobDetail['source'] | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [opening, setOpening] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [drawKind, setDrawKind] = useState<BoxKind>('problem');
  const [boxes, setBoxes] = useState<BoxData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // 보조 뷰어 (답안지/해설 참조)
  const [refMode, setRefMode] = useState<'none' | 'same' | 'answer'>('none');
  const [refDoc, setRefDoc] = useState<PDFDocumentProxy | null>(null);
  const [answerPdfUrl, setAnswerPdfUrl] = useState<string | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  const selected = boxes.find((b) => b.id === selectedId) ?? null;

  useEffect(() => {
    void refreshJobs();
  }, []);

  async function refreshJobs() {
    setJobsLoading(true);
    try {
      const { data } = await api.get<{ jobs: JobSummary[] }>('/agent/workbench');
      setJobs(data.jobs);
    } catch {
      toast.error('작업 목록을 불러오지 못했어요.');
    } finally {
      setJobsLoading(false);
    }
  }

  // ---------- 서버 동기화 ----------
  function toServerPayload(b: BoxData): BoxPayload {
    return b.kind === 'problem' ? { problem: b.problem } : { chunk: b.chunk };
  }

  /** 폼 수정은 800ms 디바운스로 서버에 반영 (이어하기·공동작업용). */
  function schedulePatch(box: BoxData) {
    if (!jobId || box.id.startsWith('temp-')) return;
    const timers = patchTimers.current;
    const prev = timers.get(box.id);
    if (prev) clearTimeout(prev);
    timers.set(
      box.id,
      setTimeout(() => {
        timers.delete(box.id);
        void api
          .patch(`/agent/workbench/${jobId}/boxes/${box.id}`, {
            kind: box.kind,
            status: box.status === 'ocr' ? 'ready' : box.status,
            payload: toServerPayload(box),
          })
          .catch(() => {});
      }, 800),
    );
  }

  function patchBox(id: string, patch: Partial<BoxData>, sync = true) {
    setBoxes((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const next = { ...b, ...patch };
        if (sync) schedulePatch(next);
        return next;
      }),
    );
  }

  // ---------- 작업 열기 / 만들기 ----------
  async function openJob(id: string) {
    if (opening) return;
    setOpening(true);
    try {
      const { data } = await api.get<JobDetail>(`/agent/workbench/${id}`);
      const loaded = await loadPdfFromUrl(data.pdfUrl);
      setDoc(loaded);
      setNumPages(loaded.numPages);
      setPageNum(1);
      setJobId(data.job.id);
      setJobTitle(data.job.title);
      setSource(data.source);
      setAnswerPdfUrl(data.answerPdfUrl);
      setRefMode('none');
      setRefDoc(null);
      setBoxes(
        data.boxes.map((b) => ({
          id: b.id,
          page: b.page,
          rect: b.rect,
          kind: b.kind,
          status: b.status === 'ocr' ? 'ready' : b.status,
          problem: b.payload.problem ?? emptyProblemValue(),
          chunk: b.payload.chunk ?? { category: null, topic: '', text: '' },
        })),
      );
      setSelectedId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '작업을 열지 못했어요.');
    } finally {
      setOpening(false);
    }
  }

  /** 다른 사람이 추가한 박스 반영 (서버 상태로 동기화). */
  async function refreshBoxes() {
    if (!jobId) return;
    try {
      const { data } = await api.get<JobDetail>(`/agent/workbench/${jobId}`);
      setBoxes(
        data.boxes.map((b) => ({
          id: b.id,
          page: b.page,
          rect: b.rect,
          kind: b.kind,
          status: b.status === 'ocr' ? 'ready' : b.status,
          problem: b.payload.problem ?? emptyProblemValue(),
          chunk: b.payload.chunk ?? { category: null, topic: '', text: '' },
        })),
      );
      setAnswerPdfUrl(data.answerPdfUrl);
      toast.success('서버와 동기화했어요.');
    } catch {
      toast.error('동기화 실패');
    }
  }

  async function startNewJob() {
    if (!pendingFile || uploading) return;
    if (!title.trim()) {
      toast.error('제목을 입력해 주세요.');
      return;
    }
    setUploading(true);
    try {
      const { data: signed } = await api.post<{ path: string; signedUrl: string }>(
        '/agent/sources/upload-url',
        { filename: pendingFile.name, size: pendingFile.size },
      );
      await axios.put(signed.signedUrl, pendingFile, {
        headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
        timeout: 600_000,
        onUploadProgress: (e) => {
          if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100));
        },
      });
      const { data: src } = await api.post<{ id: string }>('/agent/sources', {
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
      const { data: job } = await api.post<{ id: string }>('/agent/workbench', {
        sourceId: src.id,
        title: title.trim(),
      });
      toast.success('작업이 만들어졌어요 — 목록에서 누구든 이어서 할 수 있어요.');
      setCreating(false);
      setPendingFile(null);
      setTitle('');
      await openJob(job.id);
      void refreshJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setUploading(false);
    }
  }

  // ---------- 박스 ----------
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

  async function onCreate(rect: BoxRect) {
    if (!jobId) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    const kind = drawKind;
    const base: BoxData = {
      id: tempId,
      page: pageNum,
      rect,
      kind,
      status: 'ocr',
      problem: emptyProblemValue(),
      chunk: { category: null, topic: '', text: '' },
    };
    setBoxes((prev) => [...prev, base]);
    setSelectedId(tempId);

    let serverId = tempId;
    try {
      // 1) 서버에 박스 생성 (공동작업·이어하기)
      const { data } = await api.post<{ id: string }>(`/agent/workbench/${jobId}/boxes`, {
        page: pageNum,
        rect,
        kind,
        status: 'ocr',
        payload: {},
      });
      serverId = data.id;
      setBoxes((prev) => prev.map((b) => (b.id === tempId ? { ...b, id: serverId } : b)));
      setSelectedId((cur) => (cur === tempId ? serverId : cur));

      // 2) 종류별 OCR
      const image = cropToBase64(rect);
      if (!image) throw new Error('캔버스를 읽을 수 없어요.');
      let payload: BoxPayload;
      let patch: Partial<BoxData>;
      if (kind === 'problem') {
        const res = await fetch('/api/agent/ocr/problem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, mediaType: 'image/png' }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '인식 실패');
        const { problem } = (await res.json()) as { problem: OcrProblem };
        const value: WorkbenchProblemValue = {
          ...base.problem,
          problem_type: problem.problem_type,
          topic: problem.topic ?? '',
          passage: problem.passage ?? '',
          question: problem.question,
          choices: problem.choices?.length ? problem.choices : base.problem.choices,
          answer: problem.answer ?? '',
          explanation: problem.explanation ?? '',
        };
        payload = { problem: value };
        patch = { status: 'ready', problem: value };
      } else {
        const res = await fetch('/api/agent/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, mediaType: 'image/png' }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '인식 실패');
        const { text } = (await res.json()) as { text: string };
        const value: ChunkValue = { category: null, topic: '', text };
        payload = { chunk: value };
        patch = { status: 'ready', chunk: value };
      }
      patchBox(serverId, patch, false);
      await api.patch(`/agent/workbench/${jobId}/boxes/${serverId}`, {
        status: 'ready',
        payload,
      });
    } catch (e) {
      patchBox(serverId, { status: 'failed' }, false);
      if (!serverId.startsWith('temp-')) {
        void api
          .patch(`/agent/workbench/${jobId}/boxes/${serverId}`, { status: 'failed' })
          .catch(() => {});
      }
      toast.error(e instanceof Error ? e.message : '인식 실패');
    }
  }

  async function deleteBox(id: string) {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (jobId && !id.startsWith('temp-')) {
      await api.delete(`/agent/workbench/${jobId}/boxes/${id}`).catch(() => {});
    }
  }

  async function saveSelected() {
    if (!selected || !source || !jobId || saving) return;
    setSaving(true);
    try {
      let savedRef: string | null = null;
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
        savedRef = id;
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
        const { data } = await api.post<{ id: string }>(
          `/agent/sources/${source.id}/chunks`,
          { page_number: selected.page, content: c.text, chapter_path: chapterPath },
        );
        savedRef = data.id;
        toast.success(`${KIND_LABEL[selected.kind]} 청크 저장 + 임베딩 완료`);
      }
      patchBox(selected.id, { status: 'saved' }, false);
      await api
        .patch(`/agent/workbench/${jobId}/boxes/${selected.id}`, {
          status: 'saved',
          saved_ref: savedRef,
          payload: toServerPayload({ ...selected, status: 'saved' }),
        })
        .catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  // ---------- 보조 뷰어 ----------
  async function setRef(mode: 'none' | 'same' | 'answer') {
    if (mode === refMode) {
      setRefMode('none');
      setRefDoc(null);
      return;
    }
    if (mode === 'none') {
      setRefMode('none');
      setRefDoc(null);
      return;
    }
    if (mode === 'same') {
      setRefMode('same');
      setRefDoc(doc);
      return;
    }
    // answer 모드: 연결된 답안 PDF 로드, 없으면 업로드 유도
    if (!answerPdfUrl) {
      answerFileRef.current?.click();
      return;
    }
    try {
      const loaded = await loadPdfFromUrl(answerPdfUrl);
      setRefDoc(loaded);
      setRefMode('answer');
    } catch {
      toast.error('답안 PDF를 열지 못했어요.');
    }
  }

  async function uploadAnswerPdf(file: File) {
    if (!jobId) return;
    try {
      const { data: signed } = await api.post<{ path: string; signedUrl: string }>(
        '/agent/sources/upload-url',
        { filename: file.name, size: file.size },
      );
      await axios.put(signed.signedUrl, file, {
        headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
        timeout: 600_000,
      });
      await api.patch(`/agent/workbench/${jobId}`, { answer_path: signed.path });
      const { data } = await api.get<JobDetail>(`/agent/workbench/${jobId}`);
      setAnswerPdfUrl(data.answerPdfUrl);
      if (data.answerPdfUrl) {
        const loaded = await loadPdfFromUrl(data.answerPdfUrl);
        setRefDoc(loaded);
        setRefMode('answer');
        toast.success('답안 PDF를 연결했어요.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '답안 PDF 업로드 실패');
    }
  }

  /** 보조 뷰어에서 드래그한 영역 → 선택된 문제의 정답·해설로 인식해 채움 */
  async function grabAnswer(image: string) {
    if (!selected || selected.kind !== 'problem') {
      toast.error('먼저 왼쪽에서 문제 박스를 선택하세요.');
      return;
    }
    setGrabbing(true);
    try {
      const res = await fetch('/api/agent/ocr/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image,
          mediaType: 'image/png',
          hint: selected.problem.question.slice(0, 200),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '인식 실패');
      const { answer, explanation } = (await res.json()) as {
        answer?: string;
        explanation?: string;
      };
      if (!answer && !explanation) {
        toast.info('영역에서 정답·해설을 찾지 못했어요.');
        return;
      }
      patchBox(selected.id, {
        problem: {
          ...selected.problem,
          answer: answer || selected.problem.answer,
          explanation: explanation || selected.problem.explanation,
        },
      });
      toast.success(
        `가져옴 — ${answer ? `정답 ${answer}` : ''}${answer && explanation ? ' + ' : ''}${explanation ? '해설' : ''}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '인식 실패');
    } finally {
      setGrabbing(false);
    }
  }

  const pageBoxCount = boxes.filter((b) => b.page === pageNum).length;
  const savedCount = boxes.filter((b) => b.status === 'saved').length;

  // ================= 목록 / 새 작업 =================
  if (!doc || !source || !jobId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <header className="mb-4 flex items-center gap-2">
          <Scissors className="h-5 w-5 text-zinc-700" />
          <h1 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
            PDF 워크벤치
          </h1>
          <p className="ml-1 text-xs text-zinc-500">
            작업은 저장돼요 — 여럿이 같이, 나중에 이어서.
          </p>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white"
          >
            <Plus className="h-3.5 w-3.5" /> 새 작업
          </button>
        </header>

        {creating && (
          <div className="mb-4 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div
              className={cn(
                'grid h-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed text-sm',
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
                if (f) {
                  setPendingFile(f);
                  if (!title) setTitle(f.name.replace(/\.pdf$/i, '').normalize('NFC'));
                }
                e.target.value = '';
              }}
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="작업 제목 (예: 천재 평가문제집 Lesson 3)"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="출판사"
                className="h-9 rounded-md border border-zinc-200 px-2 text-sm outline-none"
              />
              <select
                value={schoolId ?? ''}
                onChange={(e) => setSchoolId(e.target.value || null)}
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm"
              >
                <option value="">학교 배정 안 함</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void startNewJob()}
              disabled={!pendingFile || uploading}
              className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {uploading ? `업로드 중… ${uploadPct}%` : '업로드하고 작업 시작'}
            </button>
          </div>
        )}

        <section className="space-y-2">
          {jobsLoading ? (
            <div className="grid h-28 place-items-center rounded-xl border border-zinc-200 bg-white text-sm text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
              아직 작업이 없어요. &quot;새 작업&quot;으로 PDF를 올려 시작하세요.
            </div>
          ) : (
            jobs.map((j) => (
              <div
                key={j.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
              >
                <Scissors className="h-4 w-4 shrink-0 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900">{j.title}</p>
                  <p className="text-xs text-zinc-500">
                    {[j.subject, j.grade].filter(Boolean).join(' · ')}
                    {j.hasAnswerPdf ? ' · 답안PDF 연결됨' : ''} · 박스 {j.boxCount}개 (저장{' '}
                    {j.savedCount}) · {new Date(j.updated_at).toLocaleString('ko-KR')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`'${j.title}' 작업판을 삭제할까요? (저장된 문제·교재는 유지)`))
                      void api
                        .delete(`/agent/workbench/${j.id}`)
                        .then(() => refreshJobs())
                        .catch(() => toast.error('삭제 실패'));
                  }}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={opening}
                  onClick={() => void openJob(j.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {opening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} 이어하기
                </button>
              </div>
            ))
          )}
        </section>
      </main>
    );
  }

  // ================= 작업 화면 =================
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setDoc(null);
            setSource(null);
            setJobId(null);
            setRefDoc(null);
            setRefMode('none');
            void refreshJobs();
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 목록
        </button>
        <h1 className="text-base font-bold tracking-tight text-zinc-900">{jobTitle}</h1>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">
          {source.subject}
        </span>
        <button
          type="button"
          onClick={() => void refreshBoxes()}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
          title="다른 사람 작업 반영"
        >
          <RefreshCw className="h-3.5 w-3.5" /> 동기화
        </button>

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
          <span className="mx-1 h-4 w-px bg-zinc-200" />
          <button
            type="button"
            onClick={() => void setRef('same')}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition',
              refMode === 'same'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
            )}
            title="같은 PDF의 해설 페이지를 옆에 띄우기"
          >
            <Columns2 className="h-3.5 w-3.5" /> 같은 PDF
          </button>
          <button
            type="button"
            onClick={() => void setRef('answer')}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition',
              refMode === 'answer'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
            )}
            title={answerPdfUrl ? '답안 PDF 열기' : '답안 PDF 업로드·연결'}
          >
            <Columns2 className="h-3.5 w-3.5" /> 답안 PDF{answerPdfUrl ? '' : ' 연결'}
          </button>
        </div>
      </header>

      <input
        ref={answerFileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadAnswerPdf(f);
          e.target.value = '';
        }}
      />

      <div
        className={cn(
          'grid gap-4',
          refDoc
            ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_400px]'
            : 'lg:grid-cols-[minmax(0,1fr)_440px]',
        )}
      >
        {/* 메인 뷰어 */}
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
            onDelete={(id) => void deleteBox(id)}
            onCreate={(r) => void onCreate(r)}
            canvasRef={canvasRef}
          />
        </section>

        {/* 보조 뷰어 (답안/해설 참조) */}
        {refDoc && (
          <section className="space-y-2">
            <p className="text-xs font-medium text-emerald-700">
              📑 {refMode === 'answer' ? '답안 PDF' : '같은 PDF (해설 참조)'} — 영역을
              드래그하고 버튼을 누르면 <b>선택된 문제</b>의 정답·해설로 들어가요.
            </p>
            <PdfRefViewer
              doc={refDoc}
              grabbing={grabbing}
              grabLabel="→ 정답·해설 가져오기"
              onGrab={(img) => void grabAnswer(img)}
            />
          </section>
        )}

        {/* 편집 패널 */}
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
