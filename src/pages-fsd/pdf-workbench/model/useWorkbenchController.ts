'use client';

import { useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { api } from '@/shared/api/axios';
import { createProblem } from '@/features/create-problem';
import { topicCategoriesFor } from '@/shared/config/topics';
import type { BoxKind, BoxRect } from '../ui/PdfBoxViewer';
import { KIND_LABEL } from '../ui/PdfBoxViewer';
import { emptyProblemValue, type WorkbenchProblemValue } from '../ui/WorkbenchProblemForm';
import type { RefGrab } from '../ui/PdfRefViewer';
import { useWorkbenchStore } from './store';
import { loadPdfFromUrl } from './loadPdf';
import type {
  AnswerRef,
  Attachment,
  BoxData,
  BoxPayload,
  ChunkValue,
  Folder,
  JobDetail,
  JobSummary,
  OcrProblem,
} from './types';

function fromServerBox(b: JobDetail['boxes'][number]): BoxData {
  // 레거시 단일 answerRef → 배열로 정규화.
  const answerRefs: AnswerRef[] = b.payload.answerRefs
    ? b.payload.answerRefs
    : b.payload.answerRef
      ? [{ id: b.payload.answerRef.id ?? crypto.randomUUID(), ...b.payload.answerRef }]
      : [];
  return {
    id: b.id,
    page: b.page,
    rect: b.rect,
    kind: b.kind,
    status: b.status === 'ocr' ? 'ready' : b.status,
    // 이전 박스엔 passage_translation·figures 등 새 필드가 없을 수 있어 기본값과 병합.
    problem: { ...emptyProblemValue(), ...(b.payload.problem ?? {}) },
    chunk: b.payload.chunk ?? { category: null, topic: '', text: '' },
    answerRefs,
    tokensIn: b.payload.tokens?.in ?? 0,
    tokensOut: b.payload.tokens?.out ?? 0,
    actor: b.actor ?? null,
    savedRef: b.saved_ref ?? null,
  };
}

function toServerPayload(b: BoxData): BoxPayload {
  const base: BoxPayload =
    b.kind === 'problem' ? { problem: b.problem } : { chunk: b.chunk };
  // answerRefs를 빠뜨리면 디바운스 PATCH가 저장된 링크를 지워버린다
  if (b.answerRefs.length) base.answerRefs = b.answerRefs;
  if (b.tokensIn > 0 || b.tokensOut > 0)
    base.tokens = { in: b.tokensIn, out: b.tokensOut };
  return base;
}

type TokenUsage = { input: number; output: number };

/** 1234 → "1.2k". */
function fmtTok(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function cropToBase64(
  canvas: HTMLCanvasElement,
  rect: BoxRect,
  mediaType: 'image/png' | 'image/jpeg' = 'image/png',
  quality?: number,
): string {
  const crop = document.createElement('canvas');
  crop.width = Math.max(1, Math.round(rect.w));
  crop.height = Math.max(1, Math.round(rect.h));
  crop
    .getContext('2d')!
    .drawImage(canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, crop.width, crop.height);
  const dataUrl = crop.toDataURL(mediaType, quality);
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

/**
 * 워크벤치 비동기 오케스트레이션 — 명령형 핸들(refs)과 네트워크/OCR/저장
 * 흐름을 보유한다. 상태는 useWorkbenchStore에서 읽고(getState로 stale 방지)
 * 액션으로 쓴다. 페이지는 이 훅 + 스토어 셀렉터만으로 동작하는 얇은 뷰.
 */
export function useWorkbenchController() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const attachFileRef = useRef<HTMLInputElement | null>(null);
  const pendingAttachRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const patchTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** 부속 PDF 문서 캐시 — 탭 전환 시 재다운로드 방지. */
  const refDocCache = useRef<Map<string, PDFDocumentProxy>>(new Map());
  /** 본 PDF 회전 굽기 동시 실행 방지. */
  const rotatingRef = useRef(false);

  // ---------- 목록 ----------
  async function refreshJobs() {
    const st = useWorkbenchStore.getState();
    st.setJobsLoading(true);
    try {
      const { data } = await api.get<{ jobs: JobSummary[] }>('/agent/workbench');
      st.setJobs(data.jobs);
    } catch {
      toast.error('작업 목록을 불러오지 못했어요.');
    } finally {
      useWorkbenchStore.getState().setJobsLoading(false);
    }
  }

  // ---------- 폴더 ----------
  async function refreshFolders() {
    try {
      const { data } = await api.get<{ folders: Folder[] }>('/agent/workbench/folders');
      useWorkbenchStore.getState().setFolders(data.folders);
    } catch {
      // non-fatal
    }
  }

  /** 현재 위치(parentId) 하위로 폴더 생성. */
  async function createFolder(name: string, parentId: string | null) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await api.post('/agent/workbench/folders', { name: trimmed, parentId });
      await refreshFolders();
    } catch {
      toast.error('폴더 생성 실패');
    }
  }

  async function renameFolder(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await api.patch(`/agent/workbench/folders/${id}`, { name: trimmed });
      await refreshFolders();
    } catch {
      toast.error('폴더 이름 변경 실패');
    }
  }

  /** 폴더를 다른 폴더 하위로 이동 (null = 최상위). */
  async function moveFolder(folderId: string, parentId: string | null) {
    try {
      await api.patch(`/agent/workbench/folders/${folderId}`, { parentId });
      await refreshFolders();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? '폴더 이동 실패');
    }
  }

  async function deleteFolder(id: string) {
    try {
      await api.delete(`/agent/workbench/folders/${id}`);
      const st = useWorkbenchStore.getState();
      if (st.currentFolderId === id) st.setCurrentFolderId(null);
      await Promise.all([refreshFolders(), refreshJobs()]);
    } catch {
      toast.error('폴더 삭제 실패');
    }
  }

  /** 작업을 폴더로 이동 (null = 최상위). */
  async function moveJob(jobId: string, folderId: string | null) {
    const st = useWorkbenchStore.getState();
    st.setJobs(st.jobs.map((j) => (j.id === jobId ? { ...j, folder_id: folderId } : j)));
    try {
      await api.patch(`/agent/workbench/${jobId}`, { folder_id: folderId });
      await refreshFolders();
    } catch {
      toast.error('폴더 이동 실패');
      void refreshJobs();
    }
  }

  /** 작업(PDF) 이름 변경. */
  async function renameJob(jobId: string, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const st = useWorkbenchStore.getState();
    st.setJobs(st.jobs.map((j) => (j.id === jobId ? { ...j, title: trimmed } : j)));
    try {
      await api.patch(`/agent/workbench/${jobId}`, { title: trimmed });
    } catch {
      toast.error('이름 변경 실패');
      void refreshJobs();
    }
  }

  // ---------- 서버 동기화 ----------
  /** 폼 수정·이동·리사이즈를 800ms 디바운스로 서버에 반영. */
  function schedulePatch(box: BoxData) {
    const { jobId } = useWorkbenchStore.getState();
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
            rect: box.rect,
            kind: box.kind,
            status: box.status === 'ocr' ? 'ready' : box.status,
            payload: toServerPayload(box),
          })
          .catch(() => {});
      }, 800),
    );
  }

  function patchBox(id: string, patch: Partial<BoxData>, sync = true) {
    const st = useWorkbenchStore.getState();
    st.updateBox(id, patch);
    if (sync) {
      const next = useWorkbenchStore.getState().boxes.find((b) => b.id === id);
      if (next) schedulePatch(next);
    }
  }

  /**
   * OCR 토큰 사용량을 세션 누계 + (boxId가 있으면) 그 박스 누계에 더하고
   * 토스트로 표시. 박스 토큰은 로컬만 갱신하고 영속은 호출부의 PATCH가 맡는다.
   */
  function reportUsage(label: string, usage?: TokenUsage, boxId?: string) {
    if (!usage) return;
    useWorkbenchStore.getState().addTokens(usage.input, usage.output);
    if (boxId) {
      const box = useWorkbenchStore.getState().boxes.find((b) => b.id === boxId);
      if (box)
        patchBox(
          boxId,
          { tokensIn: box.tokensIn + usage.input, tokensOut: box.tokensOut + usage.output },
          false,
        );
    }
    toast.info(`${label} · 토큰 ↑${fmtTok(usage.input)} ↓${fmtTok(usage.output)}`);
  }

  /**
   * 본 PDF 90° 회전 — 회전을 **원본 파일에 구워** 영속한다.
   * ① 박스 좌표를 새 방향으로 변환·저장 → ② 즉시 화면 회전(낙관적) →
   * ③ 서버가 파일을 회전해 덮어쓰고 → ④ 구운 PDF를 다시 받아 0° 기준으로 교체.
   */
  async function rotateJob(delta: 90 | -90, page?: number) {
    if (rotatingRef.current) return;
    const st = useWorkbenchStore.getState();
    const { jobId, doc, boxes } = st;
    const pageNum = page ?? st.pageNum;
    if (!jobId || !doc) return;
    rotatingRef.current = true;
    st.setRotating(true);

    // 보고 있는 페이지만 회전 — 그 페이지(0° 기준) 캔버스 크기로 박스를 변환.
    const vp = (await doc.getPage(pageNum)).getViewport({ scale: 1.5, rotation: 0 });
    const d = { w: vp.width, h: vp.height };
    const rotated = boxes.map((b) => {
      if (b.page !== pageNum) return b; // 다른 페이지는 그대로
      const { x, y, w, h } = b.rect;
      const rect =
        delta === 90
          ? { x: d.h - (y + h), y: x, w: h, h: w } // CW
          : { x: y, y: d.w - (x + w), w: h, h: w }; // CCW
      return { ...b, rect };
    });

    st.setBoxes(rotated);
    // 낙관적 화면 회전(굽기 완료 전까지 기존 doc을 viewport로 돌려 보여준다).
    st.setRotation(((delta % 360) + 360) % 360);

    // 이 페이지 박스 rect만 영속 (temp 제외).
    for (const b of rotated) {
      if (b.page !== pageNum || b.id.startsWith('temp-')) continue;
      void api
        .patch(`/agent/workbench/${jobId}/boxes/${b.id}`, { rect: b.rect })
        .catch(() => {});
    }

    try {
      // 서버에서 그 페이지를 회전해 덮어쓰고 새 서명 URL을 받는다.
      const { data } = await api.post<{ pdfUrl: string }>(
        `/agent/workbench/${jobId}/rotate`,
        { delta, page: pageNum },
      );
      const reloaded = await loadPdfFromUrl(data.pdfUrl);
      const s2 = useWorkbenchStore.getState();
      s2.setDoc(reloaded);
      s2.setRotation(0);
      // 보조 뷰어가 같은 PDF를 보고 있으면 함께 교체.
      if (s2.refSel?.type === 'same') s2.setRefDoc(reloaded);
      toast.success('PDF를 회전해 원본 파일에 저장했어요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF 회전 저장 실패');
      void refreshBoxes();
    } finally {
      rotatingRef.current = false;
      useWorkbenchStore.getState().setRotating(false);
    }
  }

  // ---------- 작업 열기 / 닫기 ----------
  async function openJob(id: string) {
    const st = useWorkbenchStore.getState();
    if (st.opening) return;
    st.setOpening(true);
    try {
      const { data } = await api.get<JobDetail>(`/agent/workbench/${id}`);
      const loaded = await loadPdfFromUrl(data.pdfUrl);
      refDocCache.current.clear();
      const s = useWorkbenchStore.getState();
      s.clearRef();
      s.setAttachments(data.attachments);
      s.setBoxes(data.boxes.map(fromServerBox));
      s.setSelectedId(null);
      s.openSession({
        jobId: data.job.id,
        jobTitle: data.job.title,
        source: data.source,
        doc: loaded,
        numPages: loaded.numPages,
        rotation: data.job.rotation ?? 0,
      });
      // 부속(부교재)이 있으면 자동으로 첫 부속을 분할 화면에 띄운다.
      if (data.attachments.length > 0) {
        await openAttachment(data.attachments[0]);
      }
      void refreshEmbedPending();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '작업을 열지 못했어요.');
    } finally {
      useWorkbenchStore.getState().setOpening(false);
    }
  }

  function closeJob() {
    const st = useWorkbenchStore.getState();
    st.closeSession();
    st.clearRef();
    st.setAttachments([]);
    st.setBoxes([]);
    st.setSelectedId(null);
    refDocCache.current.clear();
    void refreshJobs();
  }

  /** 다른 사람이 추가한 박스 반영 (서버 상태로 동기화). */
  async function refreshBoxes() {
    const { jobId } = useWorkbenchStore.getState();
    if (!jobId) return;
    try {
      const { data } = await api.get<JobDetail>(`/agent/workbench/${jobId}`);
      const st = useWorkbenchStore.getState();
      st.setBoxes(data.boxes.map(fromServerBox));
      st.setAttachments(data.attachments);
      toast.success('서버와 동기화했어요.');
    } catch {
      toast.error('동기화 실패');
    }
  }

  // ---------- 새 작업 만들기 ----------
  /** 서명 URL 발급 → Storage 직접 업로드 → 경로 반환. */
  async function uploadPdfToStorage(file: File): Promise<string> {
    const { data: signed } = await api.post<{ path: string; signedUrl: string }>(
      '/agent/sources/upload-url',
      { filename: file.name, size: file.size },
    );
    await axios.put(signed.signedUrl, file, {
      headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
      timeout: 600_000,
      onUploadProgress: (e) => {
        if (e.total)
          useWorkbenchStore.getState().setUploadPct(Math.round((e.loaded / e.total) * 100));
      },
    });
    return signed.path;
  }

  async function startNewJob() {
    const st = useWorkbenchStore.getState();
    const { pendingFile, uploading, title, pendingAttachments, sourceType, subject, grade, publisher } =
      st;
    if (!pendingFile || uploading) return;
    if (!title.trim()) {
      toast.error('제목을 입력해 주세요.');
      return;
    }
    st.setUploading(true);
    try {
      st.setUploadStep('본 PDF');
      const mainPath = await uploadPdfToStorage(pendingFile);
      const uploadedAttachments: { path: string; title: string }[] = [];
      for (const [i, att] of pendingAttachments.entries()) {
        useWorkbenchStore.getState().setUploadStep(`부속 ${i + 1}/${pendingAttachments.length}`);
        const path = await uploadPdfToStorage(att.file);
        uploadedAttachments.push({ path, title: att.title.trim() || att.file.name });
      }
      const { data: src } = await api.post<{ id: string }>('/agent/sources', {
        path: mainPath,
        original_filename: pendingFile.name.normalize('NFC'),
        file_size_bytes: pendingFile.size,
        title: title.trim(),
        source_type: sourceType,
        subject,
        subjects: [subject],
        grade,
        publisher: publisher.trim() || undefined,
        mode: 'workbench',
      });
      const { data: job } = await api.post<{ id: string }>('/agent/workbench', {
        sourceId: src.id,
        title: title.trim(),
        attachments: uploadedAttachments,
      });
      toast.success('작업이 만들어졌어요 — 목록에서 누구든 이어서 할 수 있어요.');
      useWorkbenchStore.getState().resetCreationForm();
      await openJob(job.id);
      void refreshJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      const s = useWorkbenchStore.getState();
      s.setUploading(false);
      s.setUploadStep('');
    }
  }

  // ---------- 박스 ----------
  /**
   * 박스 영역을 인식 — ① 종류(문제/개념/본문) 자동 분류 → ② 종류별 OCR → 채움.
   * 박스의 "인식" 버튼·다시 인식 공용.
   */
  async function recognizeBox(boxId: string) {
    const st = useWorkbenchStore.getState();
    const box = st.boxes.find((b) => b.id === boxId);
    if (!box || box.id.startsWith('temp-')) return;
    if (box.page !== st.pageNum) {
      st.setPage(box.page);
      toast.info('해당 박스 페이지로 이동했어요 — 인식을 한 번 더 눌러주세요.');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error('캔버스를 읽을 수 없어요.');
      return;
    }
    const image = cropToBase64(canvas, box.rect);
    const { jobId } = st;
    patchBox(boxId, { status: 'ocr' }, false);
    try {
      // ① 종류 자동 분류
      const clsRes = await fetch('/api/agent/ocr/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, mediaType: 'image/png' }),
      });
      if (!clsRes.ok)
        throw new Error((await clsRes.json().catch(() => null))?.message ?? '분류 실패');
      const cls = (await clsRes.json()) as { kind: BoxKind; usage?: TokenUsage };
      const kind = cls.kind;
      reportUsage('종류 분류', cls.usage, boxId);

      // ② 종류별 OCR
      let patch: Partial<BoxData>;
      if (kind === 'problem') {
        const subject = st.source?.subject ?? '';
        const res = await fetch('/api/agent/ocr/problem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, mediaType: 'image/png', subject }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '인식 실패');
        const { problem, usage } = (await res.json()) as {
          problem: OcrProblem;
          usage?: TokenUsage;
        };
        reportUsage('문제 인식', usage, boxId);
        // 분류는 반드시 기존 목록에 스냅 — 목록에 없는 OCR 토픽은 버린다(자유입력 금지).
        const tax = topicCategoriesFor(subject);
        const matchedCat = problem.topic
          ? tax.find((c) => c.topics.includes(problem.topic as string))
          : undefined;
        const category =
          matchedCat?.category ??
          (problem.category && tax.some((c) => c.category === problem.category)
            ? problem.category
            : box.problem.category);
        // topic은 목록에 있을 때만 채우고, 아니면 비워 사용자가 고르게 한다.
        const topic = matchedCat
          ? (problem.topic as string)
          : tax.length === 0
            ? (problem.topic ?? box.problem.topic)
            : box.problem.topic;
        const value: WorkbenchProblemValue = {
          ...box.problem,
          problem_type: problem.problem_type,
          category,
          topic,
          passage: problem.passage ?? '',
          question: problem.question,
          choices: problem.choices?.length ? problem.choices : box.problem.choices,
          // 문제 재인식은 문제 파트만 갱신 — 따로 가져온 정답·해설은 보존(비었을 때만 채움).
          answer: box.problem.answer || (problem.answer ?? ''),
          explanation: box.problem.explanation || (problem.explanation ?? ''),
        };
        patch = { status: 'ready', kind, problem: value };
      } else {
        const res = await fetch('/api/agent/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, mediaType: 'image/png' }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '인식 실패');
        const { text, usage } = (await res.json()) as { text: string; usage?: TokenUsage };
        reportUsage('내용 인식', usage, boxId);
        const value: ChunkValue = { ...box.chunk, text };
        patch = { status: 'ready', kind, chunk: value };
      }
      patchBox(boxId, patch, false);
      if (jobId) {
        // 토큰 누계도 함께 영속되도록 최신 박스의 payload로 저장.
        const fresh = useWorkbenchStore.getState().boxes.find((b) => b.id === boxId);
        if (fresh) {
          await api.patch(`/agent/workbench/${jobId}/boxes/${boxId}`, {
            status: 'ready',
            kind,
            payload: toServerPayload(fresh),
          });
        }
      }
    } catch (e) {
      patchBox(boxId, { status: 'failed' }, false);
      if (jobId) {
        void api
          .patch(`/agent/workbench/${jobId}/boxes/${boxId}`, { status: 'failed' })
          .catch(() => {});
      }
      toast.error(e instanceof Error ? e.message : '인식 실패');
    }
  }

  /** 영역만 그려 두기 — 인식은 박스의 "인식" 버튼을 눌러야 돈다. */
  async function onCreate(rect: BoxRect) {
    const st = useWorkbenchStore.getState();
    const { jobId, pageNum, drawKind } = st;
    if (!jobId) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    const base: BoxData = {
      id: tempId,
      page: pageNum,
      rect,
      kind: drawKind,
      status: 'idle',
      problem: emptyProblemValue(),
      chunk: { category: null, topic: '', text: '' },
      answerRefs: [],
      tokensIn: 0,
      tokensOut: 0,
      actor: null,
      savedRef: null,
    };
    st.addBox(base);
    st.setSelectedId(tempId);
    try {
      const { data } = await api.post<{ id: string; actor?: string | null }>(
        `/agent/workbench/${jobId}/boxes`,
        { page: pageNum, rect, kind: drawKind, status: 'idle', payload: {} },
      );
      const s2 = useWorkbenchStore.getState();
      s2.swapBoxId(tempId, data.id);
      if (data.actor) s2.updateBox(data.id, { actor: data.actor });
    } catch (e) {
      patchBox(tempId, { status: 'failed' }, false);
      toast.error(e instanceof Error ? e.message : '박스 생성 실패');
    }
  }

  /** 선택 박스 다시 인식 (영역 수정 후 등). */
  async function reocrSelected() {
    const sel = useWorkbenchStore.getState().boxes.find(
      (b) => b.id === useWorkbenchStore.getState().selectedId,
    );
    if (!sel || sel.id.startsWith('temp-')) return;
    await recognizeBox(sel.id);
  }

  /** 현재 페이지의 미인식(idle) 박스를 모두 인식. */
  async function recognizeIdleOnPage() {
    const st = useWorkbenchStore.getState();
    const ids = st.boxes
      .filter((b) => b.page === st.pageNum && b.status === 'idle' && !b.id.startsWith('temp-'))
      .map((b) => b.id);
    for (const id of ids) await recognizeBox(id);
  }

  async function deleteBox(id: string) {
    const st = useWorkbenchStore.getState();
    st.removeBox(id);
    if (st.jobId && !id.startsWith('temp-')) {
      await api.delete(`/agent/workbench/${st.jobId}/boxes/${id}`).catch(() => {});
    }
  }

  async function saveSelected() {
    const st = useWorkbenchStore.getState();
    const selected = st.boxes.find((b) => b.id === st.selectedId);
    const { source, jobId, saving } = st;
    if (!selected || !source || !jobId || saving) return;
    st.setSaving(true);
    try {
      let savedRef: string | null = null;
      if (selected.kind === 'problem') {
        const f = selected.problem;
        if (!f.question.trim() || !f.answer.trim()) {
          toast.error('발문과 정답을 채워주세요.');
          return;
        }
        const body = {
          subject: source.subject,
          topic: f.topic || null,
          difficulty: f.difficulty,
          problem_type: f.problem_type,
          passage: f.passage.trim() || null,
          passage_translation: f.passage_translation.trim() || null,
          question: f.question,
          choices:
            f.problem_type === 'objective' ? f.choices.filter((c) => c.text.trim()) : null,
          answer: f.answer.trim(),
          explanation: f.explanation || null,
          figures: f.figures.filter((fig) => fig.url),
          notes: 'PDF 워크벤치 등록',
          citations: [
            {
              sourceId: source.id,
              sourceTitle: source.title,
              page: selected.page,
              snippet: (f.passage || f.question).slice(0, 160),
            },
          ],
        };
        // 이미 저장한 박스면 새로 만들지 않고 그 문제를 갱신(중복 방지) — 계속 저장 가능.
        // 임베딩은 저장과 분리: 신규/수정 모두 embedding이 비워진 채(=대기) 저장되고,
        // 나중에 "일괄 임베딩"으로 채운다. (PATCH는 내용 변경 시 embedding을 비운다.)
        if (selected.savedRef) {
          await api.patch(`/agent/problems/${selected.savedRef}`, body);
          savedRef = selected.savedRef;
        } else {
          savedRef = (await createProblem(body)).id;
        }
        toast.success(
          selected.savedRef ? '문제 수정 저장 완료 (임베딩 대기)' : '문제 저장 완료 (임베딩 대기)',
        );
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
        toast.success(`${KIND_LABEL[selected.kind]} 저장 완료 (임베딩 대기)`);
      }
      patchBox(selected.id, { status: 'saved', savedRef }, false);
      await api
        .patch(`/agent/workbench/${jobId}/boxes/${selected.id}`, {
          status: 'saved',
          saved_ref: savedRef,
          payload: toServerPayload({ ...selected, status: 'saved' }),
        })
        .catch(() => {});
      void refreshEmbedPending();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 실패');
    } finally {
      useWorkbenchStore.getState().setSaving(false);
    }
  }

  // ---------- 보조 뷰어 ----------
  function toggleSameRef() {
    const st = useWorkbenchStore.getState();
    if (st.refSel?.type === 'same') {
      st.clearRef();
      return;
    }
    st.setRefSel({ type: 'same' });
    st.setRefDoc(st.doc);
  }

  /**
   * 보조 뷰어 90° 회전 — 메인이든 부속(해설지)이든 **보는 페이지만** 파일에 구워
   * 영속. refPage는 보조 뷰어의 현재 페이지.
   */
  async function rotateRef(delta: 90 | -90, refPage: number) {
    const st = useWorkbenchStore.getState();
    if (st.refSel?.type === 'same') {
      await rotateJob(delta, refPage);
      return;
    }
    if (st.refSel?.type !== 'attachment') return;
    if (rotatingRef.current) return;
    const { jobId } = st;
    const attId = st.refSel.id;
    const att = st.attachments.find((a) => a.id === attId);
    if (!att || !jobId) return;
    rotatingRef.current = true;
    st.setRotating(true);
    // 정규화 rect 90° 회전 (차원 무관).
    const rot = (r: { x: number; y: number; w: number; h: number }) =>
      delta === 90
        ? { x: 1 - (r.y + r.h), y: r.x, w: r.h, h: r.w }
        : { x: r.y, y: 1 - (r.x + r.w), w: r.h, h: r.w };
    try {
      // 서버에서 그 페이지를 굽는다(레거시 전체회전 att.rotation도 함께 마이그레이션).
      const { data } = await api.post<{ pdfUrl: string }>(
        `/agent/workbench/${jobId}/rotate`,
        { delta, page: refPage, attachmentId: attId, baseRotation: att.rotation },
      );
      const reloaded = await loadPdfFromUrl(data.pdfUrl);
      refDocCache.current.set(attId, reloaded);
      const s2 = useWorkbenchStore.getState();
      s2.setRefDoc(reloaded);
      // 파일에 구웠으니 메타데이터 회전 0으로.
      s2.setAttachments(
        s2.attachments.map((a) => (a.id === attId ? { ...a, rotation: 0 } : a)),
      );
      // 이 부속의 **해당 페이지** 답 링크만 delta 회전(다른 페이지는 base가 구워져 그대로 정합).
      for (const b of s2.boxes) {
        if (!b.answerRefs.some((a) => a.attachmentId === attId && a.page === refPage)) continue;
        patchBox(b.id, {
          answerRefs: b.answerRefs.map((a) =>
            a.attachmentId === attId && a.page === refPage ? { ...a, rect: rot(a.rect) } : a,
          ),
        });
      }
      toast.success('해설지 페이지를 회전해 파일에 저장했어요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '해설지 회전 실패');
    } finally {
      rotatingRef.current = false;
      useWorkbenchStore.getState().setRotating(false);
    }
  }

  async function openAttachment(att: Attachment) {
    const st = useWorkbenchStore.getState();
    if (st.refSel?.type === 'attachment' && st.refSel.id === att.id) {
      st.clearRef();
      return;
    }
    try {
      let loaded = refDocCache.current.get(att.id);
      if (!loaded) {
        loaded = await loadPdfFromUrl(att.url);
        refDocCache.current.set(att.id, loaded);
      }
      const s = useWorkbenchStore.getState();
      s.setRefDoc(loaded);
      s.setRefSel({ type: 'attachment', id: att.id });
    } catch {
      toast.error(`'${att.title}' PDF를 열지 못했어요.`);
    }
  }

  async function addAttachment(file: File) {
    const { jobId } = useWorkbenchStore.getState();
    if (!jobId) return;
    try {
      const path = await uploadPdfToStorage(file);
      const attTitle = file.name.replace(/\.pdf$/i, '').normalize('NFC');
      const { data } = await api.post<{
        attachment: { id: string; title: string; url: string };
      }>(`/agent/workbench/${jobId}/attachments`, { path, title: attTitle });
      const att: Attachment = { ...data.attachment, rotation: 0 };
      useWorkbenchStore.getState().appendAttachment(att);
      await openAttachment(att);
      toast.success(`'${att.title}' 부속 PDF를 연결했어요.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '부속 PDF 업로드 실패');
    }
  }

  async function deleteAttachment(att: Attachment) {
    const { jobId } = useWorkbenchStore.getState();
    if (!jobId) return;
    if (!confirm(`'${att.title}' 부속 PDF를 삭제할까요? (연결된 답 표시도 함께 지워져요)`))
      return;
    try {
      await api
        .delete(`/agent/workbench/${jobId}/attachments/${att.id}`)
        .catch(() => {});
      const st = useWorkbenchStore.getState();
      st.removeAttachment(att.id);
      refDocCache.current.delete(att.id);
      // 이 부속을 가리키던 답 연결만 제거(다대일) + 영속.
      for (const b of st.boxes) {
        if (!b.answerRefs.some((a) => a.attachmentId === att.id)) continue;
        patchBox(b.id, { answerRefs: b.answerRefs.filter((a) => a.attachmentId !== att.id) });
      }
      if (st.refSel?.type === 'attachment' && st.refSel.id === att.id) st.clearRef();
    } catch {
      toast.error('부속 PDF 삭제 실패');
    }
  }

  /** 보조 뷰어에서 드래그한 영역 → 선택된 문제의 정답·해설로 인식해 채움 + 링크 저장 */
  async function grabAnswer(grab: RefGrab) {
    const st = useWorkbenchStore.getState();
    const selected = st.boxes.find((b) => b.id === st.selectedId);
    if (!selected || selected.kind !== 'problem') {
      toast.error('먼저 왼쪽에서 문제 박스를 선택하세요.');
      return;
    }
    // 드래그 자체가 "이 영역이 이 문제의 답"이라는 의미 — OCR 결과와 무관하게 연결 추가(다대일)
    if (st.refSel?.type === 'attachment') {
      patchBox(selected.id, {
        answerRefs: [
          ...selected.answerRefs,
          { id: crypto.randomUUID(), attachmentId: st.refSel.id, page: grab.page, rect: grab.rect },
        ],
      });
    }
    st.setGrabbing(true);
    try {
      const res = await fetch('/api/agent/ocr/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: grab.image,
          mediaType: 'image/png',
          hint: selected.problem.question.slice(0, 200),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '인식 실패');
      const { answer, explanation, passage_translation, usage } = (await res.json()) as {
        answer?: string;
        explanation?: string;
        passage_translation?: string;
        usage?: TokenUsage;
      };
      reportUsage('정답·해설', usage, selected.id);
      if (!answer && !explanation && !passage_translation) {
        toast.info('영역에서 정답·해설을 찾지 못했어요.');
        return;
      }
      // 최신 problem 위에 병합. 해설·지문해석은 여러 영역이라 이어붙여 누적.
      const cur =
        useWorkbenchStore.getState().boxes.find((b) => b.id === selected.id) ?? selected;
      const join = (prev: string, add?: string) =>
        add ? (prev.trim() ? `${prev.trim()}\n\n${add}` : add) : prev;
      patchBox(selected.id, {
        problem: {
          ...cur.problem,
          answer: cur.problem.answer || answer || '', // 정답은 비었을 때만
          explanation: join(cur.problem.explanation, explanation),
          passage_translation: join(cur.problem.passage_translation, passage_translation),
        },
      });
      toast.success(
        `가져옴 — ${[answer ? `정답 ${answer}` : '', explanation ? '해설' : '', passage_translation ? '지문해석' : ''].filter(Boolean).join(' + ')}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '인식 실패');
    } finally {
      useWorkbenchStore.getState().setGrabbing(false);
    }
  }

  /** 답 연결 1개 해제 (텍스트는 그대로 둠). */
  function removeAnswerRef(boxId: string, refId: string) {
    const box = useWorkbenchStore.getState().boxes.find((b) => b.id === boxId);
    if (!box) return;
    patchBox(boxId, { answerRefs: box.answerRefs.filter((a) => a.id !== refId) });
  }

  /** 답 연결 전체 해제. */
  function clearAnswerRefs(boxId: string) {
    patchBox(boxId, { answerRefs: [] });
  }

  /** 부속 PDF의 한 영역(정규화 rect)을 오프스크린 렌더해 base64 PNG로 크롭. */
  async function renderRefRegion(
    att: Attachment,
    page: number,
    normRect: BoxRect,
  ): Promise<string> {
    let doc = refDocCache.current.get(att.id);
    if (!doc) {
      doc = await loadPdfFromUrl(att.url);
      refDocCache.current.set(att.id, doc);
    }
    const p = await doc.getPage(page);
    const vp = p.getViewport({ scale: 1.5, rotation: att.rotation });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width;
    canvas.height = vp.height;
    await p.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
    return cropToBase64(canvas, {
      x: normRect.x * canvas.width,
      y: normRect.y * canvas.height,
      w: normRect.w * canvas.width,
      h: normRect.h * canvas.height,
    });
  }

  /** 연결된 해설 영역들을 다시 스캔(재OCR)해 정답·해설·지문해석을 새로 채운다(덮어쓰기). */
  async function rescanAnswerRefs(boxId: string) {
    const st = useWorkbenchStore.getState();
    const box = st.boxes.find((b) => b.id === boxId);
    if (!box || box.kind !== 'problem') return;
    const refs = box.answerRefs.filter((r) =>
      st.attachments.some((a) => a.id === r.attachmentId),
    );
    if (refs.length === 0) {
      toast.info('다시 스캔할 연결된 해설 영역이 없어요. (같은 PDF 연결은 대상 아님)');
      return;
    }
    if (
      !confirm('연결된 해설 영역을 다시 스캔해 정답·해설을 새로 채울까요? 지금 입력값은 덮어써져요.')
    )
      return;
    st.setGrabbing(true);
    try {
      const answers: string[] = [];
      const explanations: string[] = [];
      const translations: string[] = [];
      for (const ref of refs) {
        const att = useWorkbenchStore.getState().attachments.find((a) => a.id === ref.attachmentId);
        if (!att) continue;
        const image = await renderRefRegion(att, ref.page, ref.rect);
        const res = await fetch('/api/agent/ocr/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image,
            mediaType: 'image/png',
            hint: box.problem.question.slice(0, 200),
          }),
        });
        if (!res.ok)
          throw new Error((await res.json().catch(() => null))?.message ?? '재스캔 실패');
        const { answer, explanation, passage_translation, usage } = (await res.json()) as {
          answer?: string;
          explanation?: string;
          passage_translation?: string;
          usage?: TokenUsage;
        };
        reportUsage('정답·해설 재스캔', usage, boxId);
        if (answer) answers.push(answer);
        if (explanation) explanations.push(explanation);
        if (passage_translation) translations.push(passage_translation);
      }
      const cur = useWorkbenchStore.getState().boxes.find((b) => b.id === boxId);
      if (!cur) return;
      patchBox(boxId, {
        problem: {
          ...cur.problem,
          answer: answers.find((a) => a.trim()) ?? '',
          explanation: explanations.join('\n\n'),
          passage_translation: translations.join('\n\n'),
        },
      });
      toast.success(`해설 ${refs.length}곳 다시 스캔 완료`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '재스캔 실패');
    } finally {
      useWorkbenchStore.getState().setGrabbing(false);
    }
  }

  // ---------- 그림/도표 ----------
  /** base64 이미지를 Storage(problem-figures)에 올리고 public URL을 돌려준다. */
  async function uploadFigure(image: string, mediaType: string): Promise<string | null> {
    try {
      const { data } = await api.post<{ url: string }>('/agent/figures', { image, mediaType });
      return data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '그림 업로드 실패');
      return null;
    }
  }

  /** 보조 뷰어에서 잡은 영역을 선택된 문제의 그림으로 추가 (크롭→압축→업로드). */
  async function grabFigure(grab: RefGrab) {
    const st = useWorkbenchStore.getState();
    const selected = st.boxes.find((b) => b.id === st.selectedId);
    if (!selected || selected.kind !== 'problem') {
      toast.error('먼저 왼쪽에서 문제 박스를 선택하세요.');
      return;
    }
    st.setGrabbing(true);
    try {
      const url = await uploadFigure(grab.image, 'image/jpeg');
      if (!url) return;
      const cur =
        useWorkbenchStore.getState().boxes.find((b) => b.id === selected.id) ?? selected;
      patchBox(selected.id, {
        problem: { ...cur.problem, figures: [...cur.problem.figures, { url }] },
      });
      toast.success('그림을 추가했어요.');
    } finally {
      useWorkbenchStore.getState().setGrabbing(false);
    }
  }

  /** 메인 뷰어에서 잡은 영역을 선택된 문제의 그림으로 추가 (본문 그림 캡처). */
  async function captureFigureFromMain(rect: BoxRect) {
    const st = useWorkbenchStore.getState();
    const selected = st.boxes.find((b) => b.id === st.selectedId);
    if (!selected || selected.kind !== 'problem') {
      toast.error('먼저 문제 박스를 선택하세요. (그림은 그 문제에 추가돼요)');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error('캔버스를 읽을 수 없어요.');
      return;
    }
    const image = cropToBase64(canvas, rect, 'image/jpeg', 0.85);
    st.setGrabbing(true);
    try {
      const url = await uploadFigure(image, 'image/jpeg');
      if (!url) return;
      const cur =
        useWorkbenchStore.getState().boxes.find((b) => b.id === selected.id) ?? selected;
      patchBox(selected.id, {
        problem: { ...cur.problem, figures: [...cur.problem.figures, { url }] },
      });
      toast.success('본문 그림을 문제에 추가했어요.');
    } finally {
      useWorkbenchStore.getState().setGrabbing(false);
    }
  }

  /** 보조 뷰어 grab — 모드에 따라 정답·해설 또는 그림으로 분기. */
  async function grabFromRef(grab: RefGrab) {
    if (grab.mode === 'figure') return grabFigure(grab);
    return grabAnswer(grab);
  }

  // ---------- 임베딩 (저장과 분리) ----------
  /** 임베딩 대기(=embedding 비어있음) 개수 갱신. */
  async function refreshEmbedPending() {
    try {
      const { data } = await api.get<{ problems: number; chunks: number }>('/agent/embeddings');
      useWorkbenchStore.getState().setEmbedPending(data);
    } catch {
      // non-fatal
    }
  }

  /** 대기분(문제+청크)을 0이 될 때까지 일괄 임베딩. */
  async function runEmbedPending() {
    const st = useWorkbenchStore.getState();
    if (st.embedRunning) return;
    if (st.embedPending.problems + st.embedPending.chunks === 0) {
      toast.info('임베딩할 대기 항목이 없어요.');
      return;
    }
    st.setEmbedRunning(true);
    const tid = toast.loading('임베딩 중…');
    try {
      let guard = 0;
      for (;;) {
        const { data } = await api.post<{
          problemsEmbedded: number;
          chunksEmbedded: number;
          problemsRemaining: number;
          chunksRemaining: number;
        }>('/agent/embeddings', { limit: 30 });
        const remaining = data.problemsRemaining + data.chunksRemaining;
        useWorkbenchStore
          .getState()
          .setEmbedPending({ problems: data.problemsRemaining, chunks: data.chunksRemaining });
        if (remaining === 0) break;
        // 남았는데 이번에 하나도 못 했으면(전부 실패) 무한루프 방지.
        if (data.problemsEmbedded + data.chunksEmbedded === 0) {
          throw new Error('일부 항목 임베딩 실패 — 잠시 후 다시 시도하세요.');
        }
        toast.loading(`임베딩 중… 남은 ${remaining}개`, { id: tid });
        if (++guard > 500) break;
      }
      toast.success('임베딩 완료', { id: tid });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '임베딩 실패', { id: tid });
    } finally {
      useWorkbenchStore.getState().setEmbedRunning(false);
      void refreshEmbedPending();
    }
  }

  /** 폼에서 파일을 직접 그림으로 업로드 → URL 반환. */
  async function uploadFigureFile(file: File): Promise<string | null> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('파일 읽기 실패'));
      fr.readAsDataURL(file);
    });
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const mediaType = dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/png';
    return uploadFigure(base64, mediaType);
  }

  return {
    canvasRef,
    fileRef,
    attachFileRef,
    pendingAttachRef,
    containerRef,
    refreshJobs,
    refreshFolders,
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    moveJob,
    renameJob,
    openJob,
    closeJob,
    refreshBoxes,
    startNewJob,
    patchBox,
    rotateJob,
    onCreate,
    recognizeBox,
    recognizeIdleOnPage,
    reocrSelected,
    deleteBox,
    saveSelected,
    toggleSameRef,
    rotateRef,
    openAttachment,
    addAttachment,
    deleteAttachment,
    grabAnswer,
    grabFromRef,
    captureFigureFromMain,
    uploadFigureFile,
    removeAnswerRef,
    clearAnswerRefs,
    rescanAnswerRefs,
    refreshEmbedPending,
    runEmbedPending,
  };
}
