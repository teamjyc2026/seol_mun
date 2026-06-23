'use client';

import { useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ProblemChoice } from '@/entities/problem';
import { api } from '@/shared/api/axios';
import {
  createProblem,
  createProblemSet,
  type ProblemSetSubProblem,
} from '@/features/create-problem';
import { topicCategoriesFor, normalizeTopicTags, categoryForTag } from '@/shared/config/topics';
import type { Subject } from '@/shared/config/subjects';
import type { BoxKind, BoxRect } from '../ui/PdfBoxViewer';
import { KIND_LABEL } from '../ui/PdfBoxViewer';
import {
  emptyProblemValue,
  type WorkbenchProblemValue,
  type WbSubProblem,
} from '../ui/WorkbenchProblemForm';
import { emptySubProblem } from '../ui/ProblemFields';
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
  OcrProblemResult,
  PageRotations,
  PartRegion,
} from './types';

function fromServerBox(b: JobDetail['boxes'][number]): BoxData {
  // 레거시 단일 answerRef → 배열로 정규화. childIndex 없는 레거시는 0(대표).
  const answerRefs: AnswerRef[] = (
    b.payload.answerRefs
      ? b.payload.answerRefs
      : b.payload.answerRef
        ? [{ id: b.payload.answerRef.id ?? crypto.randomUUID(), ...b.payload.answerRef }]
        : []
  ).map((a) => ({ ...a, childIndex: a.childIndex ?? 0 }));
  return {
    id: b.id,
    page: b.page,
    rect: b.rect,
    kind: b.kind,
    status: b.status === 'ocr' ? 'ready' : b.status,
    // 이전 박스엔 passage_translation·figures 등 새 필드가 없을 수 있어 기본값과 병합.
    problem: { ...emptyProblemValue(), ...(b.payload.problem ?? {}) },
    chunk: { category: null, topic: '', text: '', figures: [], ...(b.payload.chunk ?? {}) },
    answerRefs,
    tokensIn: b.payload.tokens?.in ?? 0,
    tokensOut: b.payload.tokens?.out ?? 0,
    actor: b.actor ?? null,
    savedRefs: b.payload.savedRefs ?? (b.saved_ref ? [b.saved_ref] : []),
    passageSetId: b.payload.passageSetId ?? null,
    parts: b.payload.parts ?? [],
  };
}

function toServerPayload(b: BoxData): BoxPayload {
  const base: BoxPayload =
    b.kind === 'problem' || b.kind === 'problemset'
      ? { problem: b.problem }
      : { chunk: b.chunk };
  // answerRefs를 빠뜨리면 디바운스 PATCH가 저장된 링크를 지워버린다
  if (b.answerRefs.length) base.answerRefs = b.answerRefs;
  if (b.tokensIn > 0 || b.tokensOut > 0)
    base.tokens = { in: b.tokensIn, out: b.tokensOut };
  if (b.savedRefs.length) base.savedRefs = b.savedRefs;
  if (b.passageSetId) base.passageSetId = b.passageSetId;
  if (b.parts.length) base.parts = b.parts;
  return base;
}

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';

/**
 * 객관식 OCR 정답(단어/번호/원문자)을 보기 라벨(①·②…)로 정규화. 못 맞추면 null.
 * 해설 본문에 섞인 문제번호 "(1)" 오인을 막으려고 보기 텍스트 매칭을 숫자보다 먼저 한다.
 */
function normalizeObjectiveAnswer(choices: ProblemChoice[], raw: string): string | null {
  const labels = choices.map((c) => c.label.trim()).filter(Boolean);
  if (!labels.length || !raw) return null;
  // 1) 보기 라벨(원문자)이 raw에 직접 있으면 그 라벨들 — 복수 정답이면 보기 순서대로 ", "로.
  const present = labels.filter((lab) => raw.includes(lab));
  if (present.length) return present.join(', ');
  // 2) 보기 텍스트 매칭 (소문자·기호 제거 정규화) — "specify" → ②.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]/gi, '');
  const rawN = norm(raw);
  if (rawN) {
    let best: { label: string; len: number } | null = null;
    for (const c of choices) {
      const t = norm(c.text);
      if (t && (rawN === t || rawN.includes(t) || t.includes(rawN))) {
        if (!best || t.length > best.len) best = { label: c.label.trim(), len: t.length };
      }
    }
    if (best) return best.label;
  }
  // 3) 원문자/숫자 → 인덱스 → 라벨 (마지막 수단).
  for (const ch of raw) {
    const ci = CIRCLED.indexOf(ch);
    if (ci >= 0 && ci < labels.length) return labels[ci];
  }
  const m = raw.match(/[1-9][0-9]?/);
  if (m) {
    const n = parseInt(m[0], 10);
    if (n >= 1 && n <= labels.length) return labels[n - 1];
  }
  return null;
}

/** 객관식이면 정답을 보기 라벨로 매핑, 아니면 원문 유지. */
function mapAnswer(sub: WbSubProblem, raw: string): string {
  if (sub.problem_type !== 'objective' || !raw) return raw;
  return normalizeObjectiveAnswer(sub.choices, raw) ?? raw;
}

/** 객관식 정답 문자열이 복수 정답(", "로 2개 이상)인지. */
function isMultiAnswer(answer: string): boolean {
  return answer.split(',').filter((s) => s.trim()).length > 1;
}

/** /ocr/answer에 넘길 보기 목록 (객관식·내용 있는 보기만). 없으면 undefined. */
function answerChoicesPayload(sub: WbSubProblem): { label: string; text: string }[] | undefined {
  if (sub.problem_type !== 'objective') return undefined;
  const list = sub.choices
    .filter((c) => c.text.trim())
    .map((c) => ({ label: c.label, text: c.text }));
  return list.length ? list : undefined;
}

/**
 * 단답형 다중 빈칸(어법/어휘 선택)의 예상 빈칸 수 — 현재 정답 줄 수와 발문 마크업
 * (<box>·<u n=>) 개수 중 큰 값. 1이면 답안 라우트에 굳이 넘기지 않는다.
 */
function countBlanks(sub: WbSubProblem): number {
  if (sub.problem_type !== 'short') return 1;
  const lines = sub.answer.split('\n').filter((a) => a.trim()).length;
  const marks = (sub.question.match(/<box|<u\s+n=/gi) ?? []).length;
  return Math.max(lines, marks, 1);
}

/** 자식 문제(0=대표, i+1=extra[i]) 조회 — 없으면 대표. */
function subProblemAt(p: WorkbenchProblemValue, idx: number): WbSubProblem {
  return idx > 0 ? (p.extra[idx - 1] ?? p) : p;
}

/** 자식 문제의 answer/explanation 갱신(passage_translation은 박스 공유) → 새 problem. */
function applyAnswerToSub(
  p: WorkbenchProblemValue,
  idx: number,
  fields: {
    answer?: string;
    explanation?: string;
    multiAnswer?: boolean;
    coreContent?: string;
    choiceExplanation?: string;
  },
  passageTranslation?: string,
): WorkbenchProblemValue {
  const pt = passageTranslation !== undefined ? passageTranslation : p.passage_translation;
  if (idx <= 0) return { ...p, ...fields, passage_translation: pt };
  const extra = p.extra.slice();
  if (extra[idx - 1]) extra[idx - 1] = { ...extra[idx - 1], ...fields };
  return { ...p, extra, passage_translation: pt };
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

  /** 페이지 회전 맵에 delta를 적용한 새 맵 반환. */
  function rotatePageRotations(
    pageRotations: PageRotations,
    pageNum: number,
    delta: 90 | -90,
  ): PageRotations {
    const cur = pageRotations[pageNum] ?? 0;
    return { ...pageRotations, [pageNum]: (((cur + delta) % 360) + 360) % 360 };
  }

  /** 보고 있는 페이지만 90° 회전 — 클라 메타데이터(즉시) + 가벼운 PATCH 저장. */
  async function rotateJob(delta: 90 | -90, page?: number) {
    const st = useWorkbenchStore.getState();
    const { jobId, doc, boxes, pageRotations } = st;
    const pageNum = page ?? st.pageNum;
    if (!jobId || !doc) return;
    // 현재 표시 회전(cur) 기준 캔버스 치수로 그 페이지 박스 rect를 회전.
    const cur = pageRotations[pageNum] ?? 0;
    const vp = (await doc.getPage(pageNum)).getViewport({ scale: 1.5, rotation: cur });
    const d = { w: vp.width, h: vp.height };
    const rotated = boxes.map((b) => {
      if (b.page !== pageNum) return b;
      const { x, y, w, h } = b.rect;
      const rect =
        delta === 90
          ? { x: d.h - (y + h), y: x, w: h, h: w } // CW
          : { x: y, y: d.w - (x + w), w: h, h: w }; // CCW
      return { ...b, rect };
    });
    const nextMap = rotatePageRotations(pageRotations, pageNum, delta);
    st.setBoxes(rotated);
    st.setPageRotations(nextMap); // 즉시 화면 회전
    // 영속: 박스 rect + 회전 메타데이터 (둘 다 가벼움).
    for (const b of rotated) {
      if (b.page !== pageNum || b.id.startsWith('temp-')) continue;
      void api
        .patch(`/agent/workbench/${jobId}/boxes/${b.id}`, { rect: b.rect })
        .catch(() => {});
    }
    void api
      .patch(`/agent/workbench/${jobId}`, { page_rotations: nextMap })
      .catch(() => {});
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
      const loadedBoxes = data.boxes.map(fromServerBox);
      s.setBoxes(loadedBoxes);
      s.setSelectedId(null);
      s.openSession({
        jobId: data.job.id,
        jobTitle: data.job.title,
        source: data.source,
        doc: loaded,
        numPages: loaded.numPages,
        pageRotations: data.job.pageRotations ?? {},
      });
      // 파일 전체 누적 토큰 = 박스별 저장된 토큰의 합 (openSession이 0으로 리셋하므로 다시 채움).
      const sumIn = loadedBoxes.reduce((acc, b) => acc + b.tokensIn, 0);
      const sumOut = loadedBoxes.reduce((acc, b) => acc + b.tokensOut, 0);
      if (sumIn > 0 || sumOut > 0) s.addTokens(sumIn, sumOut);
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
  async function recognizeBox(boxId: string, opts?: { expectCount?: number }) {
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
      // ① 종류는 사용자가 세그먼트로 고른 box.kind를 그대로 존중(자동 분류 안 함).
      //    예전엔 /ocr/classify로 재분류해 "본문"을 "문제"로 덮어쓰던 버그가 있었음.
      //    (단, 문제로 그렸어도 인식 결과가 세트면 아래에서 problemset으로 자동 전환.)
      let kind: BoxKind = box.kind;

      // ② 종류별 OCR
      let patch: Partial<BoxData>;
      if (kind === 'problem' || kind === 'problemset') {
        const subject = st.source?.subject ?? '';
        // 이어붙일 영역(parts)이 있으면 본영역+영역들을 멀티 이미지로 — 한 문제로 병합.
        const partImages =
          box.parts.length > 0
            ? await Promise.all(box.parts.map((p) => renderMainRegion(p.page, p.rect)))
            : [];
        const merged = partImages.length > 0;
        const res = await fetch('/api/agent/ocr/problem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // 문제 세트면 문항을 가급적 잘게 분리하도록 split 힌트.
          // expectCount가 오면 정확히 그 개수로 분리(사용자 지정).
          // parts가 있으면 images로 보내 한 문제로 병합(split 무시).
          body: JSON.stringify({
            ...(merged ? { images: [image, ...partImages] } : { image }),
            mediaType: 'image/png',
            subject,
            split: !merged && (box.kind === 'problemset' || !!opts?.expectCount),
            expectCount: merged ? undefined : opts?.expectCount,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '인식 실패');
        const { result, usage } = (await res.json()) as {
          result: OcrProblemResult;
          usage?: TokenUsage;
        };
        reportUsage('문제 인식', usage, boxId);
        // 분류는 기존 목록에 스냅 — 쉼표 다중 태그 중 유효한 것만(자유입력 금지).
        const hasTax = topicCategoriesFor(subject).length > 0;
        const snap = (p: OcrProblem, prev?: WbSubProblem): WbSubProblem => {
          // 유효 태그만 남긴 정규화 토픽(없으면 prev 유지). 분류 없는 과목은 원문.
          const normTopic = p.topic
            ? hasTax
              ? normalizeTopicTags(subject, p.topic)
              : p.topic
            : '';
          const topic = normTopic || prev?.topic || '';
          // category(UI 탐색)는 첫 태그 기준.
          const firstTag = topic.split(',')[0]?.trim() ?? '';
          const category = firstTag
            ? (categoryForTag(subject, firstTag) ?? prev?.category ?? null)
            : (prev?.category ?? null);
          const choices = p.choices?.length
            ? p.choices
            : (prev?.choices ?? emptySubProblem().choices);
          // 객관식 정답은 보기 라벨(①…)로 매핑해 둔다.
          const ocrAnswer =
            p.problem_type === 'objective' && p.answer
              ? (normalizeObjectiveAnswer(choices, p.answer) ?? p.answer)
              : (p.answer ?? '');
          // 재인식 시 따로 가져온 정답·해설은 보존(비었을 때만 채움).
          const answer = prev?.answer || ocrAnswer;
          return {
            problem_type: p.problem_type,
            difficulty: prev?.difficulty ?? 'medium',
            category,
            topic,
            question: p.question,
            choices,
            answer,
            explanation: prev?.explanation || (p.explanation ?? ''),
            // OCR이 복수 정답으로 인식하면 복수정답 토글도 자동 ON(이미 켠 건 유지).
            multiAnswer:
              (prev?.multiAnswer ?? false) ||
              (p.problem_type === 'objective' && isMultiAnswer(answer)),
            coreContent: prev?.coreContent || (p.coreContent ?? ''),
            choiceExplanation: prev?.choiceExplanation || (p.choiceExplanation ?? ''),
          };
        };
        const ocrProblems = result.problems ?? [];
        const primary = ocrProblems[0] ? snap(ocrProblems[0], box.problem) : null;
        const extra = ocrProblems.slice(1).map((p) => snap(p));
        // 문제로 그렸어도 인식 결과가 세트(문제 2개 이상)면 '문제 세트'로 자동 전환.
        // (오른쪽 종류 토글로 다시 '문제'로 되돌릴 수 있음.)
        if (kind === 'problem' && extra.length > 0) kind = 'problemset';
        const value: WorkbenchProblemValue = {
          ...box.problem,
          ...(primary ?? {}),
          passage: result.passage ?? box.problem.passage,
          passage_translation: result.passage_translation || box.problem.passage_translation,
          extra,
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
      chunk: { category: null, topic: '', text: '', figures: [] },
      answerRefs: [],
      tokensIn: 0,
      tokensOut: 0,
      actor: null,
      savedRefs: [],
      passageSetId: null,
      parts: [],
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
    if (!confirm('이 영역을 다시 인식할까요? 지문·발문·보기가 새로 인식한 내용으로 덮어써집니다. (정답·해설은 유지)'))
      return;
    await recognizeBox(sel.id);
  }

  /** 선택 박스를 정확히 count개의 문항으로 다시 나눠 인식 (세트가 한 문제로 합쳐졌을 때). */
  async function resplitSelected(count: number) {
    const st = useWorkbenchStore.getState();
    const sel = st.boxes.find((b) => b.id === st.selectedId);
    if (!sel || sel.id.startsWith('temp-')) return;
    if (
      !confirm(
        `이 영역을 정확히 ${count}개 문항으로 다시 나눠 인식할까요? 발문·보기가 새로 인식한 내용으로 덮어써집니다.`,
      )
    )
      return;
    await recognizeBox(sel.id, { expectCount: count });
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
    const box = st.boxes.find((b) => b.id === id);
    // 저장된 문제/교재가 딸린 박스면 그 레코드까지 함께 지울지 확인.
    if (box && box.savedRefs.length > 0) {
      const isProblem = box.kind === 'problem' || box.kind === 'problemset';
      const label = isProblem ? `저장한 문제 ${box.savedRefs.length}개` : '저장한 교재 내용';
      if (!confirm(`이 박스와 ${label}를 삭제할까요? 되돌릴 수 없어요.`)) return;
      const sourceId = st.source?.id;
      for (const ref of box.savedRefs) {
        if (isProblem) {
          await api.delete(`/agent/problems/${ref}`).catch(() => {});
        } else if (sourceId) {
          await api
            .delete(`/agent/sources/${sourceId}/chunks?chunkId=${ref}`)
            .catch(() => {});
        }
      }
    }
    st.removeBox(id);
    if (st.jobId && !id.startsWith('temp-')) {
      await api.delete(`/agent/workbench/${st.jobId}/boxes/${id}`).catch(() => {});
    }
    void refreshEmbedPending();
  }

  async function saveSelected() {
    const st = useWorkbenchStore.getState();
    const selected = st.boxes.find((b) => b.id === st.selectedId);
    const { source, jobId, saving } = st;
    if (!selected || !source || !jobId || saving) return;
    st.setSaving(true);
    try {
      let savedRefs: string[] = [];
      let passageSetId: string | null = null;
      const cite = (snippet: string) => [
        { sourceId: source.id, sourceTitle: source.title, page: selected.page, snippet: snippet.slice(0, 160) },
      ];
      if (selected.kind === 'problem' || selected.kind === 'problemset') {
        const f = selected.problem;
        const primary: WbSubProblem = {
          problem_type: f.problem_type,
          difficulty: f.difficulty,
          category: f.category,
          topic: f.topic,
          question: f.question,
          choices: f.choices,
          answer: f.answer,
          explanation: f.explanation,
          multiAnswer: f.multiAnswer,
          coreContent: f.coreContent,
          choiceExplanation: f.choiceExplanation,
        };
        const allSubs = [primary, ...f.extra];
        for (let i = 0; i < allSubs.length; i++) {
          const sub = allSubs[i];
          const where = allSubs.length > 1 ? `문제 ${i + 1}: ` : '';
          if (!sub.question.trim()) {
            toast.error(`${where}발문을 입력하세요.`);
            return;
          }
          if (!sub.answer.trim()) {
            toast.error(`${where}정답을 입력하세요.`);
            return;
          }
        }
        const sharedFigures = f.figures.filter((fig) => fig.url);
        const subBody = (sub: WbSubProblem, withFigures: boolean): ProblemSetSubProblem => ({
          topic: sub.topic || null,
          difficulty: sub.difficulty,
          problem_type: sub.problem_type,
          question: sub.question,
          choices: sub.problem_type === 'objective' ? sub.choices.filter((c) => c.text.trim()) : null,
          answer: sub.answer.trim(),
          explanation: sub.explanation || null,
          core_content: sub.coreContent?.trim() || null,
          choice_explanation: sub.choiceExplanation?.trim() || null,
          figures: withFigures ? sharedFigures : undefined,
          notes: f.extra.length > 0 ? 'PDF 워크벤치 세트' : 'PDF 워크벤치 등록',
          citations: cite(f.passage || sub.question),
        });

        if (f.extra.length > 0) {
          // 세트 — 기존 저장분 삭제 후 (공유 지문은 선택) 여러 문제로 재생성.
          for (const id of selected.savedRefs) {
            await api.delete(`/agent/problems/${id}`).catch(() => {});
          }
          const r = await createProblemSet({
            subject: source.subject as Subject,
            subjects: [source.subject as Subject],
            passage: f.passage.trim() || undefined,
            shared: { topic: f.topic || null },
            problems: allSubs.map((sub, i) => subBody(sub, i === 0)),
          });
          savedRefs = r.ids;
          passageSetId = r.passageSetId;
          toast.success(`지문 세트 저장 — 문제 ${r.ids.length}개 (임베딩 대기)`);
        } else {
          // 단일 문제.
          const body = {
            subject: source.subject,
            passage: f.passage.trim() || null,
            passage_translation: f.passage_translation.trim() || null,
            ...subBody(primary, true),
          };
          // 이전에 세트였던 잔여 id 정리.
          for (const id of selected.savedRefs.slice(1)) {
            await api.delete(`/agent/problems/${id}`).catch(() => {});
          }
          if (selected.savedRefs[0]) {
            await api.patch(`/agent/problems/${selected.savedRefs[0]}`, body);
            savedRefs = [selected.savedRefs[0]];
          } else {
            savedRefs = [(await createProblem(body)).id];
          }
          toast.success(
            selected.savedRefs[0] ? '문제 수정 저장 완료 (임베딩 대기)' : '문제 저장 완료 (임베딩 대기)',
          );
        }
      } else {
        const c = selected.chunk;
        if (c.text.trim().length < 10) {
          toast.error(`${KIND_LABEL[selected.kind]} 내용이 너무 짧아요 (10자 이상).`);
          return;
        }
        const chapterPath = [
          KIND_LABEL[selected.kind],
          ...(c.category ? [c.category] : []),
          ...(c.topic ? [c.topic] : []),
        ];
        const { data } = await api.post<{ id: string }>(
          `/agent/sources/${source.id}/chunks`,
          {
            page_number: selected.page,
            content: c.text,
            chapter_path: chapterPath,
            figures: c.figures.filter((f) => f.url),
          },
        );
        savedRefs = [data.id];
        toast.success(`${KIND_LABEL[selected.kind]} 저장 완료 (임베딩 대기)`);
      }
      patchBox(selected.id, { status: 'saved', savedRefs, passageSetId }, false);
      const fresh = useWorkbenchStore.getState().boxes.find((b) => b.id === selected.id);
      await api
        .patch(`/agent/workbench/${jobId}/boxes/${selected.id}`, {
          status: 'saved',
          saved_ref: savedRefs[0] ?? null,
          payload: fresh ? toServerPayload(fresh) : {},
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
    const { jobId } = st;
    const attId = st.refSel.id;
    const att = st.attachments.find((a) => a.id === attId);
    if (!att || !jobId) return;
    // 정규화 rect 90° 회전 (차원 무관).
    const rot = (r: { x: number; y: number; w: number; h: number }) =>
      delta === 90
        ? { x: 1 - (r.y + r.h), y: r.x, w: r.h, h: r.w }
        : { x: r.y, y: 1 - (r.x + r.w), w: r.h, h: r.w };
    const nextMap = rotatePageRotations(att.pageRotations, refPage, delta);
    // 즉시: 부속 회전 메타데이터 + 그 페이지 답 링크 회전.
    st.setAttachments(
      st.attachments.map((a) => (a.id === attId ? { ...a, pageRotations: nextMap } : a)),
    );
    for (const b of st.boxes) {
      if (!b.answerRefs.some((a) => a.attachmentId === attId && a.page === refPage)) continue;
      patchBox(b.id, {
        answerRefs: b.answerRefs.map((a) =>
          a.attachmentId === attId && a.page === refPage ? { ...a, rect: rot(a.rect) } : a,
        ),
      });
    }
    void api
      .patch(`/agent/workbench/${jobId}/attachments/${attId}`, { page_rotations: nextMap })
      .catch(() => {});
  }

  /**
   * 전 페이지 회전을 0으로 초기화(메타데이터 비움) — 잘못 회전된 것 복구.
   * target='main'이면 본 PDF, 'ref'면 보조 뷰어가 보는 부속(같은 PDF면 본 PDF).
   */
  function resetRotation(target: 'main' | 'ref' = 'ref') {
    const st = useWorkbenchStore.getState();
    const { jobId } = st;
    if (!jobId) return;
    const attId =
      target === 'ref' && st.refSel?.type === 'attachment' ? st.refSel.id : null;
    if (attId) {
      st.setAttachments(
        st.attachments.map((a) => (a.id === attId ? { ...a, pageRotations: {} } : a)),
      );
      void api
        .patch(`/agent/workbench/${jobId}/attachments/${attId}`, { page_rotations: {} })
        .catch(() => {});
    } else {
      st.setPageRotations({});
      void api.patch(`/agent/workbench/${jobId}`, { page_rotations: {} }).catch(() => {});
    }
    toast.success('회전을 초기화했어요. 필요한 페이지만 다시 돌려주세요.');
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
      const att: Attachment = { ...data.attachment, pageRotations: {} };
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

  /** 보조 뷰어 영역을 스캔 없이 그 문제에 "연결만" 추가 (나중에 일괄 스캔). */
  function connectAnswerRef(page: number, rect: BoxRect, childIdx = 0) {
    const st = useWorkbenchStore.getState();
    const selected = st.boxes.find((b) => b.id === st.selectedId);
    if (!selected || (selected.kind !== 'problem' && selected.kind !== 'problemset')) {
      toast.error('먼저 왼쪽에서 문제 박스를 선택하세요.');
      return;
    }
    if (st.refSel?.type !== 'attachment') {
      toast.info('"연결만"은 부속(해설) PDF에서만 돼요. 같은 PDF는 바로 인식하세요.');
      return;
    }
    patchBox(selected.id, {
      answerRefs: [
        ...selected.answerRefs,
        { id: crypto.randomUUID(), attachmentId: st.refSel.id, page, rect, childIndex: childIdx },
      ],
    });
    const label = childIdx > 0 ? `문제 ${childIdx + 1} ` : '';
    toast.success(`${label}해설 영역 연결 추가 (스캔 대기) — "연결 전부 스캔"으로 한 번에 인식.`);
  }

  /** 보조 뷰어에서 드래그한 영역 → 선택된 박스의 childIdx 문제 정답·해설로 인식해 채움 + 링크. */
  async function grabAnswer(grab: RefGrab, childIdx = 0) {
    const st = useWorkbenchStore.getState();
    const selected = st.boxes.find((b) => b.id === st.selectedId);
    if (!selected || (selected.kind !== 'problem' && selected.kind !== 'problemset')) {
      toast.error('먼저 왼쪽에서 문제 박스를 선택하세요.');
      return;
    }
    // 드래그 자체가 "이 영역이 이 문제의 답" — 자식 인덱스로 태깅해 연결 추가.
    if (st.refSel?.type === 'attachment') {
      patchBox(selected.id, {
        answerRefs: [
          ...selected.answerRefs,
          {
            id: crypto.randomUUID(),
            attachmentId: st.refSel.id,
            page: grab.page,
            rect: grab.rect,
            childIndex: childIdx,
          },
        ],
      });
    }
    st.setGrabbing(true);
    try {
      const targetSub = subProblemAt(selected.problem, childIdx);
      const res = await fetch('/api/agent/ocr/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: grab.image,
          mediaType: 'image/png',
          hint: targetSub.question.slice(0, 200),
          choices: answerChoicesPayload(targetSub),
          blanks: countBlanks(targetSub) > 1 ? countBlanks(targetSub) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '인식 실패');
      const { answer, explanation, passage_translation, coreContent, choiceExplanation, usage } =
        (await res.json()) as {
          answer?: string;
          explanation?: string;
          passage_translation?: string;
          coreContent?: string;
          choiceExplanation?: string;
          usage?: TokenUsage;
        };
      reportUsage('정답·해설', usage, selected.id);
      if (!answer && !explanation && !passage_translation && !coreContent && !choiceExplanation) {
        toast.info('영역에서 정답·해설을 찾지 못했어요.');
        return;
      }
      const cur =
        useWorkbenchStore.getState().boxes.find((b) => b.id === selected.id) ?? selected;
      const sub = subProblemAt(cur.problem, childIdx);
      // 객관식이면 "specify" 같은 단어 정답을 보기 번호(②)로 매핑.
      const mappedAnswer = mapAnswer(sub, answer ?? '');
      const newAnswer = mappedAnswer || sub.answer || '';
      // grab = "이 영역이 이 문제의 풀이" — 새로 잡은 값으로 덮어쓴다(있을 때만).
      // 그래야 영역을 다시 잡으면 정답·해설이 갱신된다(이어붙이거나 무시하지 않음).
      patchBox(selected.id, {
        problem: applyAnswerToSub(
          cur.problem,
          childIdx,
          {
            answer: newAnswer,
            explanation: explanation ?? sub.explanation,
            // 해설 스캔 정답이 복수면 복수정답 토글 자동 ON.
            multiAnswer:
              sub.multiAnswer || (sub.problem_type === 'objective' && isMultiAnswer(newAnswer)),
            coreContent: coreContent ?? sub.coreContent,
            choiceExplanation: choiceExplanation ?? sub.choiceExplanation,
          },
          passage_translation ?? cur.problem.passage_translation,
        ),
      });
      const label = childIdx > 0 ? `문제 ${childIdx + 1} ` : '';
      toast.success(
        `${label}가져옴 — ${[mappedAnswer ? `정답 ${mappedAnswer}` : '', explanation ? '해설' : '', passage_translation ? '지문해석' : '', coreContent ? '핵심내용' : '', choiceExplanation ? '선지해석' : ''].filter(Boolean).join(' + ')}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '인식 실패');
    } finally {
      useWorkbenchStore.getState().setGrabbing(false);
    }
  }

  /** 답 연결 영역 1개의 rect 갱신 (보조 뷰어에서 재선택·이동·리사이즈). */
  function updateAnswerRefRect(boxId: string, refId: string, rect: AnswerRef['rect']) {
    const box = useWorkbenchStore.getState().boxes.find((b) => b.id === boxId);
    if (!box) return;
    patchBox(boxId, {
      answerRefs: box.answerRefs.map((a) => (a.id === refId ? { ...a, rect } : a)),
    });
  }

  /** 답 연결 1개 해제 (텍스트는 그대로 둠). */
  function removeAnswerRef(boxId: string, refId: string) {
    const box = useWorkbenchStore.getState().boxes.find((b) => b.id === boxId);
    if (!box) return;
    patchBox(boxId, { answerRefs: box.answerRefs.filter((a) => a.id !== refId) });
  }

  /** 답 연결 해제 — childIdx가 주어지면 그 자식 것만, 아니면 전체. */
  function clearAnswerRefs(boxId: string, childIdx?: number) {
    const box = useWorkbenchStore.getState().boxes.find((b) => b.id === boxId);
    if (!box) return;
    patchBox(boxId, {
      answerRefs:
        childIdx === undefined
          ? []
          : box.answerRefs.filter((a) => a.childIndex !== childIdx),
    });
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
    const vp = p.getViewport({ scale: 1.5, rotation: att.pageRotations[page] ?? 0 });
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

  /** 메인 PDF의 한 페이지 영역(정규화 rect)을 오프스크린 렌더해 base64 PNG로 크롭. */
  async function renderMainRegion(page: number, normRect: BoxRect): Promise<string> {
    const st = useWorkbenchStore.getState();
    const doc = st.doc;
    if (!doc) throw new Error('PDF를 읽을 수 없어요.');
    const p = await doc.getPage(page);
    const vp = p.getViewport({ scale: 1.5, rotation: st.pageRotations[page] ?? 0 });
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

  /** 선택 문제 박스에 "이어붙일 영역" 추가 (메인 뷰어 드래그 px → 정규화). */
  function addPartToSelected(rect: BoxRect) {
    const st = useWorkbenchStore.getState();
    const selected = st.boxes.find((b) => b.id === st.selectedId);
    if (!selected) {
      toast.error('먼저 이어붙일 문제 박스를 선택하세요.');
      return;
    }
    if (selected.kind !== 'problem') {
      toast.info('"영역 잇기"는 단일 문제 박스에만 — 세트는 문제 추가를 쓰세요.');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    const part: PartRegion = {
      id: crypto.randomUUID(),
      page: st.pageNum,
      rect: {
        x: rect.x / canvas.width,
        y: rect.y / canvas.height,
        w: rect.w / canvas.width,
        h: rect.h / canvas.height,
      },
    };
    patchBox(selected.id, { parts: [...selected.parts, part] });
    toast.success(`이어붙일 영역 추가 (p.${part.page}). 인식하면 한 문제로 합쳐져요.`);
  }

  function removePart(boxId: string, partId: string) {
    const box = useWorkbenchStore.getState().boxes.find((b) => b.id === boxId);
    if (!box) return;
    patchBox(boxId, { parts: box.parts.filter((p) => p.id !== partId) });
  }

  /** 이어붙인 영역 1개의 rect 갱신 (이동·리사이즈, 정규화 0–1). */
  function updatePartRect(boxId: string, partId: string, rect: BoxRect) {
    const box = useWorkbenchStore.getState().boxes.find((b) => b.id === boxId);
    if (!box) return;
    patchBox(boxId, {
      parts: box.parts.map((p) => (p.id === partId ? { ...p, rect } : p)),
    });
  }

  /** childIdx 자식의 연결된 해설 영역을 다시 스캔(재OCR)해 그 자식 정답·해설을 덮어쓴다. */
  async function rescanAnswerRefs(boxId: string, childIdx = 0) {
    const st = useWorkbenchStore.getState();
    const box = st.boxes.find((b) => b.id === boxId);
    if (!box || (box.kind !== 'problem' && box.kind !== 'problemset')) return;
    const refs = box.answerRefs.filter(
      (r) => r.childIndex === childIdx && st.attachments.some((a) => a.id === r.attachmentId),
    );
    if (refs.length === 0) {
      toast.info('다시 스캔할 연결된 해설 영역이 없어요. (같은 PDF 연결은 대상 아님)');
      return;
    }
    st.setGrabbing(true);
    try {
      const answers: string[] = [];
      const explanations: string[] = [];
      const translations: string[] = [];
      const coreContents: string[] = [];
      const choiceExplanations: string[] = [];
      for (const ref of refs) {
        const att = useWorkbenchStore.getState().attachments.find((a) => a.id === ref.attachmentId);
        if (!att) continue;
        const image = await renderRefRegion(att, ref.page, ref.rect);
        const rescanSub = subProblemAt(box.problem, childIdx);
        const res = await fetch('/api/agent/ocr/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image,
            mediaType: 'image/png',
            hint: rescanSub.question.slice(0, 200),
            choices: answerChoicesPayload(rescanSub),
            blanks: countBlanks(rescanSub) > 1 ? countBlanks(rescanSub) : undefined,
          }),
        });
        if (!res.ok)
          throw new Error((await res.json().catch(() => null))?.message ?? '재스캔 실패');
        const { answer, explanation, passage_translation, coreContent, choiceExplanation, usage } =
          (await res.json()) as {
            answer?: string;
            explanation?: string;
            passage_translation?: string;
            coreContent?: string;
            choiceExplanation?: string;
            usage?: TokenUsage;
          };
        reportUsage('정답·해설 재스캔', usage, boxId);
        if (answer) answers.push(answer);
        if (explanation) explanations.push(explanation);
        if (passage_translation) translations.push(passage_translation);
        if (coreContent) coreContents.push(coreContent);
        if (choiceExplanation) choiceExplanations.push(choiceExplanation);
      }
      const cur = useWorkbenchStore.getState().boxes.find((b) => b.id === boxId);
      if (!cur) return;
      const rescanRaw = answers.find((a) => a.trim()) ?? '';
      // 빈 결과로 기존 정답·해설을 지우지 않는다 — 찾은 항목만 덮어쓴다.
      if (
        !rescanRaw &&
        explanations.length === 0 &&
        translations.length === 0 &&
        coreContents.length === 0 &&
        choiceExplanations.length === 0
      ) {
        toast.info('재스캔했지만 정답·해설을 못 찾았어요. 연결 영역을 조정해 보세요.');
        return;
      }
      const targetSub = subProblemAt(cur.problem, childIdx);
      const rescanAnswer = rescanRaw ? mapAnswer(targetSub, rescanRaw) : targetSub.answer;
      patchBox(boxId, {
        problem: applyAnswerToSub(
          cur.problem,
          childIdx,
          {
            answer: rescanAnswer,
            explanation: explanations.length ? explanations.join('\n\n') : targetSub.explanation,
            multiAnswer:
              targetSub.multiAnswer ||
              (targetSub.problem_type === 'objective' && isMultiAnswer(rescanAnswer)),
            coreContent: coreContents.length ? coreContents.join('\n\n') : targetSub.coreContent,
            choiceExplanation: choiceExplanations.length
              ? choiceExplanations.join('\n\n')
              : targetSub.choiceExplanation,
          },
          translations.length ? translations.join('\n\n') : cur.problem.passage_translation,
        ),
      });
      toast.success(`문제 ${childIdx + 1} 해설 다시 스캔 완료`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '재스캔 실패');
    } finally {
      useWorkbenchStore.getState().setGrabbing(false);
    }
  }

  /** 부속 연결이 있는 모든 자식 문제를 한 번에 스캔(자식별 재스캔 순회). */
  async function scanAllAnswerRefs(boxId: string) {
    const st = useWorkbenchStore.getState();
    const box = st.boxes.find((b) => b.id === boxId);
    if (!box) return;
    const childIdxs = Array.from(
      new Set(
        box.answerRefs
          .filter((r) => st.attachments.some((a) => a.id === r.attachmentId))
          .map((r) => r.childIndex),
      ),
    ).sort((a, b) => a - b);
    if (childIdxs.length === 0) {
      toast.info('스캔할 부속 해설 연결이 없어요.');
      return;
    }
    for (const ci of childIdxs) {
      await rescanAnswerRefs(boxId, ci);
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

  /** 선택된 박스(문제/개념/본문)의 figures에 url을 추가. */
  function appendFigureToBox(boxId: string, url: string) {
    const cur = useWorkbenchStore.getState().boxes.find((b) => b.id === boxId);
    if (!cur) return;
    if (cur.kind === 'problem' || cur.kind === 'problemset') {
      patchBox(boxId, { problem: { ...cur.problem, figures: [...cur.problem.figures, { url }] } });
    } else {
      patchBox(boxId, { chunk: { ...cur.chunk, figures: [...cur.chunk.figures, { url }] } });
    }
  }

  /** 보조 뷰어에서 잡은 영역을 선택된 박스의 그림으로 추가 (크롭→압축→업로드). */
  async function grabFigure(grab: RefGrab) {
    const st = useWorkbenchStore.getState();
    const selected = st.boxes.find((b) => b.id === st.selectedId);
    if (!selected) {
      toast.error('먼저 왼쪽에서 박스를 선택하세요.');
      return;
    }
    st.setGrabbing(true);
    try {
      const url = await uploadFigure(grab.image, 'image/jpeg');
      if (!url) return;
      appendFigureToBox(selected.id, url);
      toast.success('그림을 추가했어요.');
    } finally {
      useWorkbenchStore.getState().setGrabbing(false);
    }
  }

  /** 메인 뷰어에서 잡은 영역을 선택된 박스의 그림으로 추가 (본문 그림 캡처). */
  async function captureFigureFromMain(rect: BoxRect) {
    const st = useWorkbenchStore.getState();
    const selected = st.boxes.find((b) => b.id === st.selectedId);
    if (!selected) {
      toast.error('먼저 박스를 선택하세요. (그림은 그 박스에 추가돼요)');
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
      appendFigureToBox(selected.id, url);
      toast.success('그림을 추가했어요.');
    } finally {
      useWorkbenchStore.getState().setGrabbing(false);
    }
  }

  /** 보조 뷰어 grab — 모드에 따라 정답·해설(자식 childIdx) 또는 그림으로 분기. */
  async function grabFromRef(grab: RefGrab, childIdx = 0) {
    if (grab.mode === 'figure') return grabFigure(grab);
    return grabAnswer(grab, childIdx);
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

  /** 지문을 한국어 해석으로 생성 (해설지에 해석이 없을 때). 토큰은 선택 박스에 집계. */
  async function translatePassage(passage: string): Promise<string | null> {
    const text = passage.trim();
    if (!text) return null;
    const st = useWorkbenchStore.getState();
    try {
      const res = await fetch('/api/agent/ocr/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, subject: st.source?.subject }),
      });
      if (!res.ok)
        throw new Error((await res.json().catch(() => null))?.message ?? '해석 생성 실패');
      const { translation, usage } = (await res.json()) as {
        translation: string;
        usage?: TokenUsage;
      };
      reportUsage('지문 해석', usage, st.selectedId ?? undefined);
      if (!translation.trim()) {
        toast.info('해석을 생성하지 못했어요.');
        return null;
      }
      toast.success('지문 해석을 생성했어요.');
      return translation;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '해석 생성 실패');
      return null;
    }
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
    resetRotation,
    recognizeBox,
    recognizeIdleOnPage,
    reocrSelected,
    resplitSelected,
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
    addPartToSelected,
    removePart,
    updatePartRect,
    uploadFigureFile,
    translatePassage,
    removeAnswerRef,
    updateAnswerRefRect,
    clearAnswerRefs,
    rescanAnswerRefs,
    connectAnswerRef,
    scanAllAnswerRefs,
    refreshEmbedPending,
    runEmbedPending,
  };
}
