'use client';

import { useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { api } from '@/shared/api/axios';
import { createProblem } from '@/features/create-problem';
import type { BoxRect } from '../ui/PdfBoxViewer';
import { KIND_LABEL } from '../ui/PdfBoxViewer';
import { emptyProblemValue, type WorkbenchProblemValue } from '../ui/WorkbenchProblemForm';
import type { RefGrab } from '../ui/PdfRefViewer';
import { useWorkbenchStore } from './store';
import { loadPdfFromUrl } from './loadPdf';
import type {
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
  return {
    id: b.id,
    page: b.page,
    rect: b.rect,
    kind: b.kind,
    status: b.status === 'ocr' ? 'ready' : b.status,
    problem: b.payload.problem ?? emptyProblemValue(),
    chunk: b.payload.chunk ?? { category: null, topic: '', text: '' },
    answerRef: b.payload.answerRef ?? null,
  };
}

function toServerPayload(b: BoxData): BoxPayload {
  const base: BoxPayload =
    b.kind === 'problem' ? { problem: b.problem } : { chunk: b.chunk };
  // answerRef를 빠뜨리면 디바운스 PATCH가 저장된 링크를 지워버린다
  return b.answerRef ? { ...base, answerRef: b.answerRef } : base;
}

function cropToBase64(canvas: HTMLCanvasElement, rect: BoxRect): string {
  const crop = document.createElement('canvas');
  crop.width = Math.max(1, Math.round(rect.w));
  crop.height = Math.max(1, Math.round(rect.h));
  crop
    .getContext('2d')!
    .drawImage(canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, crop.width, crop.height);
  const dataUrl = crop.toDataURL('image/png');
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

  async function createFolder(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await api.post('/agent/workbench/folders', { name: trimmed });
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

  async function deleteFolder(id: string) {
    try {
      await api.delete(`/agent/workbench/folders/${id}`);
      const st = useWorkbenchStore.getState();
      if (st.folderFilter === id) st.setFolderFilter(null);
      await Promise.all([refreshFolders(), refreshJobs()]);
    } catch {
      toast.error('폴더 삭제 실패');
    }
  }

  /** 작업을 폴더로 이동 (null = 미분류). */
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
      });
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
  /** 박스 영역(rect)을 크롭해 종류별 OCR → 결과로 박스 갱신. 생성·다시인식 공용. */
  async function recognizeBox(boxId: string) {
    const st = useWorkbenchStore.getState();
    const box = st.boxes.find((b) => b.id === boxId);
    if (!box) return;
    if (box.page !== st.pageNum) {
      st.setPage(box.page);
      toast.info('해당 박스 페이지로 이동했어요 — 다시 인식을 한 번 더 눌러주세요.');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error('캔버스를 읽을 수 없어요.');
      return;
    }
    const image = cropToBase64(canvas, box.rect);
    const { jobId } = st;
    try {
      let payload: BoxPayload;
      let patch: Partial<BoxData>;
      if (box.kind === 'problem') {
        const res = await fetch('/api/agent/ocr/problem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, mediaType: 'image/png' }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '인식 실패');
        const { problem } = (await res.json()) as { problem: OcrProblem };
        const value: WorkbenchProblemValue = {
          ...box.problem,
          problem_type: problem.problem_type,
          topic: problem.topic ?? box.problem.topic,
          passage: problem.passage ?? '',
          question: problem.question,
          choices: problem.choices?.length ? problem.choices : box.problem.choices,
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
        const value: ChunkValue = { ...box.chunk, text };
        payload = { chunk: value };
        patch = { status: 'ready', chunk: value };
      }
      patchBox(boxId, patch, false);
      if (jobId && !boxId.startsWith('temp-')) {
        await api.patch(`/agent/workbench/${jobId}/boxes/${boxId}`, {
          status: 'ready',
          payload,
        });
      }
    } catch (e) {
      patchBox(boxId, { status: 'failed' }, false);
      if (jobId && !boxId.startsWith('temp-')) {
        void api
          .patch(`/agent/workbench/${jobId}/boxes/${boxId}`, { status: 'failed' })
          .catch(() => {});
      }
      toast.error(e instanceof Error ? e.message : '인식 실패');
    }
  }

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
      status: 'ocr',
      problem: emptyProblemValue(),
      chunk: { category: null, topic: '', text: '' },
      answerRef: null,
    };
    st.addBox(base);
    st.setSelectedId(tempId);
    try {
      const { data } = await api.post<{ id: string }>(`/agent/workbench/${jobId}/boxes`, {
        page: pageNum,
        rect,
        kind: drawKind,
        status: 'ocr',
        payload: {},
      });
      useWorkbenchStore.getState().swapBoxId(tempId, data.id);
      await recognizeBox(data.id);
    } catch (e) {
      patchBox(tempId, { status: 'failed' }, false);
      toast.error(e instanceof Error ? e.message : '박스 생성 실패');
    }
  }

  /** 선택 박스의 영역을 다시 인식 (영역 수정 후 수동 재-OCR). */
  async function reocrSelected() {
    const st = useWorkbenchStore.getState();
    const sel = st.boxes.find((b) => b.id === st.selectedId);
    if (!sel || sel.id.startsWith('temp-')) return;
    patchBox(sel.id, { status: 'ocr' }, false);
    await recognizeBox(sel.id);
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
        const { id } = await createProblem({
          subject: source.subject,
          topic: f.topic || null,
          difficulty: f.difficulty,
          problem_type: f.problem_type,
          passage: f.passage.trim() || null,
          question: f.question,
          choices:
            f.problem_type === 'objective' ? f.choices.filter((c) => c.text.trim()) : null,
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
      const { data } = await api.post<{ attachment: Attachment }>(
        `/agent/workbench/${jobId}/attachments`,
        { path, title: attTitle },
      );
      useWorkbenchStore.getState().appendAttachment(data.attachment);
      await openAttachment(data.attachment);
      toast.success(`'${data.attachment.title}' 부속 PDF를 연결했어요.`);
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
      const { data } = await api.delete<{ ok: boolean; clearedBoxIds: string[] }>(
        `/agent/workbench/${jobId}/attachments/${att.id}`,
      );
      const st = useWorkbenchStore.getState();
      st.removeAttachment(att.id);
      refDocCache.current.delete(att.id);
      const cleared = new Set(data.clearedBoxIds);
      st.setBoxes(
        st.boxes.map((b) => (cleared.has(b.id) ? { ...b, answerRef: null } : b)),
      );
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
    // 드래그 자체가 "이 영역이 이 문제의 답"이라는 의미 — OCR 결과와 무관하게 연결 저장
    if (st.refSel?.type === 'attachment') {
      patchBox(selected.id, {
        answerRef: { attachmentId: st.refSel.id, page: grab.page, rect: grab.rect },
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
      const { answer, explanation } = (await res.json()) as {
        answer?: string;
        explanation?: string;
      };
      if (!answer && !explanation) {
        toast.info('영역에서 정답·해설을 찾지 못했어요.');
        return;
      }
      // 최신 problem 위에 병합 (answerRef 저장 후 상태가 바뀌었을 수 있음)
      const cur =
        useWorkbenchStore.getState().boxes.find((b) => b.id === selected.id) ?? selected;
      patchBox(selected.id, {
        problem: {
          ...cur.problem,
          answer: answer || cur.problem.answer,
          explanation: explanation || cur.problem.explanation,
        },
      });
      toast.success(
        `가져옴 — ${answer ? `정답 ${answer}` : ''}${answer && explanation ? ' + ' : ''}${explanation ? '해설' : ''}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '인식 실패');
    } finally {
      useWorkbenchStore.getState().setGrabbing(false);
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
    deleteFolder,
    moveJob,
    openJob,
    closeJob,
    refreshBoxes,
    startNewJob,
    patchBox,
    onCreate,
    reocrSelected,
    deleteBox,
    saveSelected,
    toggleSameRef,
    openAttachment,
    addAttachment,
    deleteAttachment,
    grabAnswer,
  };
}
