'use client';

import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  FileUp,
  Folder as FolderIcon,
  Home,
  Layers,
  Lightbulb,
  Loader2,
  Pencil,
  PencilLine,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  ScanText,
  Scissors,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { api } from '@/shared/api/axios';
import { SUBJECTS } from '@/shared/config/subjects';
import { cn } from '@/shared/lib/cn';
import { PdfBoxViewer, KIND_LABEL, type BoxKind } from './PdfBoxViewer';
import { ConnectionLine } from './ConnectionLine';
import { FiguresEditor } from './FiguresEditor';
import { PdfRefViewer } from './PdfRefViewer';
import { TopicPicker } from './TopicPicker';
import { WorkbenchProblemForm } from './WorkbenchProblemForm';
import { useWorkbenchController, useWorkbenchStore } from '../model';

const SOURCE_TYPES = ['교과서', '문제집', '기출', '요약본', '강의자료', '기타'];
const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];

const KIND_ICON: Record<BoxKind, typeof PencilLine> = {
  problem: PencilLine,
  problemset: Layers,
  concept: Lightbulb,
  passage: BookOpen,
};

/** 같은 family는 payload(문제/청크)가 같아 저장 후에도 종류 전환이 안전. */
const KIND_FAMILY: Record<BoxKind, 'problem' | 'chunk'> = {
  problem: 'problem',
  problemset: 'problem',
  concept: 'chunk',
  passage: 'chunk',
};

/** 1234 → "1.2k". */
function fmtTok(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** 드롭된 항목 중 PDF만 추려낸다. */
function pdfFilesFromDrop(e: React.DragEvent): File[] {
  return Array.from(e.dataTransfer.files).filter(
    (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
  );
}

export function PdfWorkbenchPage() {
  const {
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
    grabFromRef,
    captureFigureFromMain,
    uploadFigureFile,
    removeAnswerRef,
    updateAnswerRefRect,
    clearAnswerRefs,
    rescanAnswerRefs,
    runEmbedPending,
    refreshEmbedPending,
  } = useWorkbenchController();

  const s = useWorkbenchStore(
    useShallow((st) => ({
      // 목록 / 생성 폼
      jobs: st.jobs,
      jobsLoading: st.jobsLoading,
      jobSubjectFilter: st.jobSubjectFilter,
      folders: st.folders,
      currentFolderId: st.currentFolderId,
      creating: st.creating,
      pendingFile: st.pendingFile,
      pendingAttachments: st.pendingAttachments,
      title: st.title,
      subject: st.subject,
      grade: st.grade,
      sourceType: st.sourceType,
      publisher: st.publisher,
      uploading: st.uploading,
      uploadPct: st.uploadPct,
      uploadStep: st.uploadStep,
      // 세션
      jobId: st.jobId,
      jobTitle: st.jobTitle,
      source: st.source,
      doc: st.doc,
      opening: st.opening,
      pageNum: st.pageNum,
      numPages: st.numPages,
      pageRotations: st.pageRotations,
      tokensIn: st.tokensIn,
      tokensOut: st.tokensOut,
      embedPending: st.embedPending,
      embedRunning: st.embedRunning,
      // 박스
      boxes: st.boxes,
      selectedId: st.selectedId,
      drawKind: st.drawKind,
      saving: st.saving,
      figureCapture: st.figureCapture,
      setFigureCapture: st.setFigureCapture,
      // 보조 뷰어
      attachments: st.attachments,
      refSel: st.refSel,
      refDoc: st.refDoc,
      grabbing: st.grabbing,
      // 액션
      setCreating: st.setCreating,
      setPendingFile: st.setPendingFile,
      addPendingAttachments: st.addPendingAttachments,
      removePendingAttachment: st.removePendingAttachment,
      setPendingAttachmentTitle: st.setPendingAttachmentTitle,
      setTitle: st.setTitle,
      setSubject: st.setSubject,
      setGrade: st.setGrade,
      setSourceType: st.setSourceType,
      setPublisher: st.setPublisher,
      setJobSubjectFilter: st.setJobSubjectFilter,
      setCurrentFolderId: st.setCurrentFolderId,
      setDrawKind: st.setDrawKind,
      setPage: st.setPage,
      setSelectedId: st.setSelectedId,
    })),
  );

  /** 드래그 호버 표시 (순수 UI). */
  const [dragZone, setDragZone] = useState<'main' | 'attach' | null>(null);
  /** Finder 드래그 중인 항목 + 드롭 하이라이트. */
  const [dragItem, setDragItem] = useState<{ kind: 'job' | 'folder'; id: string } | null>(
    null,
  );
  const [dropTarget, setDropTarget] = useState<string | 'root' | null>(null);
  /** 세트에서 지금 풀이(정답·해설)를 받는 자식 문제 (0=대표, i+1=extra[i]). */
  const [activeChild, setActiveChild] = useState(0);
  /** 문제 세트 "문항 수로 다시 인식"의 목표 문항 수. */
  const [splitN, setSplitN] = useState(2);
  /** 메인 뷰어 표시 배율 (1=컨테이너 맞춤). */
  const [zoom, setZoom] = useState(1);
  const zoomBy = (d: number) =>
    setZoom((z) => Math.min(3, Math.max(0.5, Math.round((z + d) * 100) / 100)));
  // 박스를 새로 고르면 활성 자식을 대표(0)로 되돌린다 (렌더 중 보정 — effect 아님).
  const [prevSelectedId, setPrevSelectedId] = useState(s.selectedId);
  if (s.selectedId !== prevSelectedId) {
    setPrevSelectedId(s.selectedId);
    setActiveChild(0);
    const cur = s.boxes.find((b) => b.id === s.selectedId);
    setSplitN(Math.max(2, cur ? 1 + cur.problem.extra.length : 2));
  }

  const selected = s.boxes.find((b) => b.id === s.selectedId) ?? null;
  const refSel = s.refSel;
  /** 세트(문제 세트 종류이거나 추가 문제가 있으면)인지 — 자식별 풀이 UI를 켠다. */
  const isSet =
    !!selected && (selected.kind === 'problemset' || selected.problem.extra.length > 0);
  const childCount = selected ? 1 + selected.problem.extra.length : 1;
  // 추가 문제가 줄었을 때 활성 자식이 범위를 벗어나지 않게 클램프.
  const activeChildSafe = Math.min(activeChild, childCount - 1);
  /** 현재 활성 자식에 연결된 답 영역들. */
  const childRefs = selected
    ? selected.answerRefs.filter((a) => a.childIndex === activeChildSafe)
    : [];
  /** 선택 박스의 답 연결 중 현재 열린 부속 PDF 대상인 것들 (다대일). */
  const linkedRefs =
    selected && refSel?.type === 'attachment'
      ? selected.answerRefs
          .filter((a) => a.attachmentId === refSel.id)
          .map((a) => ({ id: a.id, page: a.page, rect: a.rect, childIndex: a.childIndex }))
      : [];
  /** 보조 뷰어 페이지별 회전 맵 — 부속이면 그 부속 것, 같은 PDF면 본 작업 것. */
  const refPageRotations =
    refSel?.type === 'attachment'
      ? (s.attachments.find((a) => a.id === refSel.id)?.pageRotations ?? {})
      : s.pageRotations;
  useEffect(() => {
    useWorkbenchStore.getState().resetAll();
    void refreshJobs();
    void refreshFolders();
    void refreshEmbedPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pageBoxCount = s.boxes.filter((b) => b.page === s.pageNum).length;
  const pageIdleCount = s.boxes.filter(
    (b) => b.page === s.pageNum && b.status === 'idle',
  ).length;
  const savedCount = s.boxes.filter((b) => b.status === 'saved').length;

  // ----- Finder 트리 -----
  const folderById = new Map(s.folders.map((f) => [f.id, f]));
  const currentFolderId = s.currentFolderId;
  const currentFolder = currentFolderId ? (folderById.get(currentFolderId) ?? null) : null;
  // 현재 위치의 하위폴더.
  const subFolders = s.folders.filter((f) => f.parentId === currentFolderId);
  // 현재 위치의 작업 (+ 과목 필터).
  const visibleJobs = s.jobs.filter((j) => {
    if (s.jobSubjectFilter && j.subject !== s.jobSubjectFilter) return false;
    return (j.folder_id ?? null) === currentFolderId;
  });
  // breadcrumb 경로 (루트→현재).
  const crumbs: { id: string; name: string }[] = [];
  for (let f = currentFolder; f; f = f.parentId ? (folderById.get(f.parentId) ?? null) : null) {
    crumbs.unshift({ id: f.id, name: f.name });
  }
  // 드래그한 폴더의 자기 자신+하위 집합 (그쪽으론 드롭 금지).
  function descendantsOf(id: string): Set<string> {
    const out = new Set<string>([id]);
    let added = true;
    while (added) {
      added = false;
      for (const f of s.folders) {
        if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
          out.add(f.id);
          added = true;
        }
      }
    }
    return out;
  }
  /** 드래그 항목을 target 폴더(null=루트)로 드롭할 수 있나. */
  function canDrop(target: string | null): boolean {
    if (!dragItem) return false;
    if (dragItem.kind === 'folder') {
      if (target !== null && descendantsOf(dragItem.id).has(target)) return false;
      const cur = folderById.get(dragItem.id)?.parentId ?? null;
      return cur !== target; // 이미 그 위치면 무의미
    }
    const cur = s.jobs.find((j) => j.id === dragItem.id)?.folder_id ?? null;
    return cur !== target;
  }
  function doDrop(target: string | null) {
    if (!dragItem || !canDrop(target)) return;
    if (dragItem.kind === 'folder') void moveFolder(dragItem.id, target);
    else void moveJob(dragItem.id, target);
  }

  // ================= 목록 / 새 작업 =================
  if (!s.doc || !s.source || !s.jobId) {
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
          {(() => {
            const pending = s.embedPending.problems + s.embedPending.chunks;
            if (pending === 0 && !s.embedRunning) return null;
            return (
              <button
                type="button"
                disabled={s.embedRunning}
                onClick={() => void runEmbedPending()}
                title="저장과 분리된 임베딩 — 대기분(신규·수정 문제/청크)을 한 번에 임베딩"
                className="ml-auto inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-violet-300 bg-violet-50 px-3 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-60"
              >
                {s.embedRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                임베딩 대기 {pending} · 일괄
              </button>
            );
          })()}
          <button
            type="button"
            onClick={() => s.setCreating(!s.creating)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white',
              s.embedPending.problems + s.embedPending.chunks === 0 && !s.embedRunning && 'ml-auto',
            )}
          >
            <Plus className="h-3.5 w-3.5" /> 새 작업
          </button>
        </header>

        {s.creating && (
          <div className="mb-4 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div
              className={cn(
                'grid h-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed text-sm transition',
                dragZone === 'main'
                  ? 'border-indigo-500 bg-indigo-100 text-indigo-700'
                  : s.pendingFile
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-zinc-300 text-zinc-400',
              )}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragZone('main');
              }}
              onDragLeave={() => setDragZone(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragZone(null);
                const f = pdfFilesFromDrop(e)[0];
                if (f) {
                  s.setPendingFile(f);
                  if (!s.title) s.setTitle(f.name.replace(/\.pdf$/i, '').normalize('NFC'));
                }
              }}
            >
              {s.pendingFile ? (
                <span className="flex items-center gap-2">
                  <FileUp className="h-4 w-4" /> {s.pendingFile.name}
                </span>
              ) : (
                <span className="text-center">
                  여기로 PDF를 끌어다 놓거나 클릭해서 선택
                </span>
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
                  s.setPendingFile(f);
                  if (!s.title) s.setTitle(f.name.replace(/\.pdf$/i, '').normalize('NFC'));
                }
                e.target.value = '';
              }}
            />
            <div
              className={cn(
                'space-y-2 rounded-xl transition',
                dragZone === 'attach' && 'bg-indigo-50 p-2 ring-2 ring-indigo-300',
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragZone('attach');
              }}
              onDragLeave={() => setDragZone(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragZone(null);
                const files = pdfFilesFromDrop(e);
                if (files.length) {
                  s.addPendingAttachments(
                    files.map((file) => ({
                      file,
                      title: file.name.replace(/\.pdf$/i, '').normalize('NFC'),
                    })),
                  );
                }
              }}
            >
              {s.pendingAttachments.map((att, i) => (
                <div
                  key={`${att.file.name}-${i}`}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
                >
                  <Columns2 className="h-4 w-4 shrink-0 text-zinc-400" />
                  <input
                    value={att.title}
                    onChange={(e) => s.setPendingAttachmentTitle(i, e.target.value)}
                    placeholder="부속 자료 이름 (예: 답안지)"
                    className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-400"
                  />
                  <span className="hidden max-w-[160px] truncate text-[11px] text-zinc-400 sm:block">
                    {att.file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => s.removePendingAttachment(i)}
                    className="rounded-md p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => pendingAttachRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 hover:border-indigo-300 hover:text-indigo-600"
              >
                <Plus className="h-3.5 w-3.5" /> 부속 PDF 추가 (드래그 또는 클릭 — 여러 개 가능)
              </button>
              <input
                ref={pendingAttachRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) {
                    s.addPendingAttachments(
                      files.map((file) => ({
                        file,
                        title: file.name.replace(/\.pdf$/i, '').normalize('NFC'),
                      })),
                    );
                  }
                  e.target.value = '';
                }}
              />
            </div>
            <input
              value={s.title}
              onChange={(e) => s.setTitle(e.target.value)}
              placeholder="작업 제목 (예: 천재 평가문제집 Lesson 3)"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <div className="flex flex-wrap gap-1.5">
              {SUBJECTS.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => s.setSubject(sub)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                    s.subject === sub
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                  )}
                >
                  {sub}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <select
                value={s.grade}
                onChange={(e) => s.setGrade(e.target.value)}
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <select
                value={s.sourceType}
                onChange={(e) => s.setSourceType(e.target.value)}
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                value={s.publisher}
                onChange={(e) => s.setPublisher(e.target.value)}
                placeholder="출판사"
                className="h-9 rounded-md border border-zinc-200 px-2 text-sm outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void startNewJob()}
              disabled={!s.pendingFile || s.uploading}
              className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {s.uploading
                ? `${s.uploadStep} 업로드 중… ${s.uploadPct}%`
                : '업로드하고 작업 시작'}
            </button>
          </div>
        )}

        {/* Finder — 경로(breadcrumb) */}
        <div className="mb-3 flex flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => s.setCurrentFolderId(null)}
            onDragOver={(e) => {
              if (canDrop(null)) {
                e.preventDefault();
                setDropTarget('root');
              }
            }}
            onDragLeave={() => setDropTarget((t) => (t === 'root' ? null : t))}
            onDrop={() => {
              doDrop(null);
              setDropTarget(null);
            }}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition',
              dropTarget === 'root'
                ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400'
                : currentFolderId === null
                  ? 'text-zinc-900'
                  : 'text-zinc-500 hover:bg-zinc-100',
            )}
          >
            <Home className="h-3.5 w-3.5" /> 홈
          </button>
          {crumbs.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />
              <button
                type="button"
                onClick={() => s.setCurrentFolderId(c.id)}
                onDragOver={(e) => {
                  if (canDrop(c.id)) {
                    e.preventDefault();
                    setDropTarget(c.id);
                  }
                }}
                onDragLeave={() => setDropTarget((t) => (t === c.id ? null : t))}
                onDrop={() => {
                  doDrop(c.id);
                  setDropTarget(null);
                }}
                className={cn(
                  'rounded-md px-2 py-1 font-medium transition',
                  dropTarget === c.id
                    ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400'
                    : i === crumbs.length - 1
                      ? 'text-zinc-900'
                      : 'text-zinc-500 hover:bg-zinc-100',
                )}
              >
                {c.name}
              </button>
            </span>
          ))}
        </div>

        {/* 과목 필터 */}
        {s.jobs.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => s.setJobSubjectFilter(null)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                s.jobSubjectFilter === null
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
              )}
            >
              전체
            </button>
            {SUBJECTS.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => s.setJobSubjectFilter(sub)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                  s.jobSubjectFilter === sub
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                )}
              >
                {sub}
              </button>
            ))}
          </div>
        )}

        {/* 하위폴더 + 새 폴더 (드래그로 작업·폴더 받기) */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {subFolders.map((f) => (
            <div
              key={f.id}
              draggable
              onDragStart={(e) => {
                setDragItem({ kind: 'folder', id: f.id });
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', f.id);
              }}
              onDragEnd={() => {
                setDragItem(null);
                setDropTarget(null);
              }}
              onDragOver={(e) => {
                if (canDrop(f.id)) {
                  e.preventDefault();
                  setDropTarget(f.id);
                }
              }}
              onDragLeave={() => setDropTarget((t) => (t === f.id ? null : t))}
              onDrop={() => {
                doDrop(f.id);
                setDropTarget(null);
              }}
              onClick={() => s.setCurrentFolderId(f.id)}
              className={cn(
                'group flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition',
                dropTarget === f.id
                  ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-400'
                  : 'border-zinc-200 hover:border-indigo-300 hover:bg-indigo-50/40',
                dragItem?.kind === 'folder' && dragItem.id === f.id && 'opacity-40',
              )}
            >
              <FolderIcon className="h-5 w-5 shrink-0 text-indigo-500" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-800">
                {f.name}
              </span>
              <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 text-[11px] text-zinc-500">
                {f.jobCount}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const name = prompt('폴더 이름', f.name);
                  if (name?.trim()) void renameFolder(f.id, name);
                }}
                className="rounded p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600 group-hover:text-zinc-400"
                title="이름 변경"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`'${f.name}' 폴더를 삭제할까요? (하위 폴더 포함, 작업은 미분류로)`))
                    void deleteFolder(f.id);
                }}
                className="rounded p-1 text-zinc-300 hover:bg-rose-50 hover:text-rose-600 group-hover:text-zinc-400"
                title="폴더 삭제"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const name = prompt('새 폴더 이름');
              if (name?.trim()) void createFolder(name, currentFolderId);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 px-3 py-2.5 text-sm text-zinc-500 hover:border-indigo-300 hover:text-indigo-600"
          >
            <Plus className="h-4 w-4" /> 새 폴더
          </button>
        </div>

        <section className="space-y-2">
          {s.jobsLoading ? (
            <div className="grid h-28 place-items-center rounded-xl border border-zinc-200 bg-white text-sm text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : visibleJobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
              {s.jobs.length === 0
                ? '아직 작업이 없어요. "새 작업"으로 PDF를 올려 시작하세요.'
                : '이 위치엔 작업이 없어요. 작업을 끌어다 폴더에 넣거나, 폴더를 열어보세요.'}
            </div>
          ) : (
            visibleJobs.map((j) => (
              <div
                key={j.id}
                draggable
                onDragStart={(e) => {
                  setDragItem({ kind: 'job', id: j.id });
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', j.id);
                }}
                onDragEnd={() => {
                  setDragItem(null);
                  setDropTarget(null);
                }}
                className={cn(
                  'flex cursor-grab items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm active:cursor-grabbing',
                  dragItem?.kind === 'job' && dragItem.id === j.id && 'opacity-40',
                )}
              >
                <Scissors className="h-4 w-4 shrink-0 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900">{j.title}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {[j.subject, j.grade].filter(Boolean).join(' · ')} · 박스 {j.boxCount}개 (저장{' '}
                    {j.savedCount}) · {new Date(j.updated_at).toLocaleString('ko-KR')}
                  </p>
                  {j.attachmentTitles.length > 0 && (
                    <p className="truncate text-[11px] text-zinc-400" title={j.attachmentTitles.join(', ')}>
                      📎 {j.attachmentTitles.join(', ')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const title = prompt('PDF 이름', j.title);
                    if (title?.trim()) void renameJob(j.id, title);
                  }}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  title="이름 변경"
                >
                  <Pencil className="h-4 w-4" />
                </button>
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
                  disabled={s.opening}
                  onClick={() => void openJob(j.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {s.opening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} 이어하기
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
          onClick={() => closeJob()}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 목록
        </button>
        <h1 className="text-base font-bold tracking-tight text-zinc-900">{s.jobTitle}</h1>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">
          {s.source.subject}
        </span>
        <button
          type="button"
          onClick={() => void refreshBoxes()}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
          title="다른 사람 작업 반영"
        >
          <RefreshCw className="h-3.5 w-3.5" /> 동기화
        </button>
        <span
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium tabular-nums text-amber-700"
          title="이 작업에서 Opus(OCR)가 쓴 누적 토큰"
        >
          🪙 ↑{fmtTok(s.tokensIn)} ↓{fmtTok(s.tokensOut)}
        </span>
        {(() => {
          const pending = s.embedPending.problems + s.embedPending.chunks;
          return (
            <button
              type="button"
              disabled={s.embedRunning || pending === 0}
              onClick={() => void runEmbedPending()}
              title="저장과 분리된 임베딩 — 대기분(신규·수정 문제/청크)을 한 번에 임베딩. 차원 변경 후 전체 재임베딩도 이걸로."
              className={cn(
                'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1.5 text-xs font-medium tabular-nums transition disabled:cursor-default',
                pending > 0
                  ? 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100'
                  : 'border-zinc-200 bg-white text-zinc-400',
              )}
            >
              {s.embedRunning ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
              )}
              {pending > 0 ? `임베딩 대기 ${pending} · 일괄 임베딩` : '임베딩 최신'}
            </button>
          );
        })()}

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-zinc-500">보조 뷰어:</span>
          <button
            type="button"
            onClick={() => toggleSameRef()}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition',
              s.refSel?.type === 'same'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
            )}
            title="같은 PDF의 해설 페이지를 옆에 띄우기"
          >
            <Columns2 className="h-3.5 w-3.5" /> 같은 PDF
          </button>
          {s.attachments.map((att) => {
            const active = s.refSel?.type === 'attachment' && s.refSel.id === att.id;
            return (
              <span
                key={att.id}
                className={cn(
                  'inline-flex items-center overflow-hidden rounded-md border text-xs font-medium transition',
                  active
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-zinc-200 bg-white text-zinc-600',
                )}
              >
                <button
                  type="button"
                  onClick={() => void openAttachment(att)}
                  className={cn(
                    'inline-flex max-w-[140px] items-center gap-1 px-2.5 py-1.5',
                    !active && 'hover:bg-zinc-50',
                  )}
                  title={`'${att.title}' 옆에 띄우기`}
                >
                  <Columns2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{att.title}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void deleteAttachment(att)}
                  className="border-l border-zinc-200 px-1 py-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                  title="부속 PDF 삭제"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => attachFileRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-zinc-300 px-2 py-1.5 text-xs text-zinc-500 hover:border-indigo-300 hover:text-indigo-600"
            title="부속 PDF(답안지·해설 등) 추가"
          >
            <Plus className="h-3.5 w-3.5" /> 부속
          </button>
        </div>
      </header>

      <input
        ref={attachFileRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          void (async () => {
            for (const f of files) await addAttachment(f);
          })();
          e.target.value = '';
        }}
      />

      <div
        ref={containerRef}
        className={cn(
          'relative grid gap-4',
          s.refDoc
            ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_400px]'
            : 'lg:grid-cols-[minmax(0,1fr)_440px]',
        )}
      >
        <ConnectionLine
          containerRef={containerRef}
          active={linkedRefs.length > 0 && !!s.refDoc}
          fromSelector={`[data-box-id="${s.selectedId}"]`}
          toSelector="[data-answer-link]"
        />
        {/* 메인 뷰어 */}
        <section className="min-w-0 space-y-2">
          <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <button
              type="button"
              disabled={s.pageNum <= 1}
              onClick={() => s.setPage(s.pageNum - 1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-zinc-700">
              {s.pageNum} / {s.numPages} p
            </span>
            <button
              type="button"
              disabled={s.pageNum >= s.numPages}
              onClick={() => s.setPage(s.pageNum + 1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="mx-1 h-4 w-px bg-zinc-200" />
            <button
              type="button"
              onClick={() => void rotateJob(-90)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              title="이 페이지만 왼쪽으로 90° 회전"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void rotateJob(90)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              title="이 페이지만 오른쪽으로 90° 회전"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => resetRotation('main')}
              className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-zinc-200 px-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50"
              title="이 PDF의 모든 페이지 회전을 0°로 되돌림"
            >
              초기화
            </button>
            <span className="mx-1 h-4 w-px bg-zinc-200" />
            {/* 확대/축소 — 표시 배율만 조절(좌표 불변) */}
            <button
              type="button"
              disabled={zoom <= 0.5}
              onClick={() => zoomBy(-0.25)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
              title="축소"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="inline-flex h-7 min-w-[3rem] items-center justify-center rounded-md border border-zinc-200 px-1 text-[11px] font-medium tabular-nums text-zinc-600 hover:bg-zinc-50"
              title="배율 초기화 (맞춤)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              disabled={zoom >= 3}
              onClick={() => zoomBy(0.25)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
              title="확대"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <span className="mx-1 h-4 w-px bg-zinc-200" />
            {/* 좌측 모드 세그먼트 — 우측 보조뷰어(정답·해설/그림)와 일관된 형태 */}
            <div className="flex rounded-md border border-zinc-200 p-0.5">
              {(Object.keys(KIND_LABEL) as BoxKind[]).map((k) => {
                const Icon = KIND_ICON[k];
                // 박스 선택 시 그 박스 종류를 반영, 아니면 새 박스(drawKind).
                const active =
                  !s.figureCapture && (selected ? selected.kind === k : s.drawKind === k);
                const activeCls =
                  k === 'problem'
                    ? 'bg-indigo-600 text-white'
                    : k === 'problemset'
                      ? 'bg-fuchsia-600 text-white'
                      : k === 'concept'
                        ? 'bg-amber-600 text-white'
                        : 'bg-emerald-600 text-white';
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      s.setFigureCapture(false);
                      s.setDrawKind(k);
                      // 선택 박스 종류 변경 — 저장 후엔 payload가 같은 family
                      // (문제↔문제 세트, 개념↔본문)끼리만 안전하게 전환.
                      if (
                        selected &&
                        (selected.status !== 'saved' ||
                          KIND_FAMILY[selected.kind] === KIND_FAMILY[k])
                      ) {
                        patchBox(selected.id, { kind: k });
                      }
                    }}
                    className={cn(
                      'inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-1 text-[11px] font-medium transition',
                      active ? activeCls : 'text-zinc-500 hover:bg-zinc-50',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" /> {KIND_LABEL[k]}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => s.setFigureCapture(true)}
                title="본문 영역을 드래그해 선택한 문제의 그림으로 캡처"
                className={cn(
                  'inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-1 text-[11px] font-medium transition',
                  s.figureCapture ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:bg-zinc-50',
                )}
              >
                <Scissors className="h-3.5 w-3.5 shrink-0" /> 그림
              </button>
            </div>
            {pageIdleCount > 0 && (
              <button
                type="button"
                onClick={() => void recognizeIdleOnPage()}
                className="ml-auto inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                title="이 페이지의 미인식 박스를 모두 인식"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" /> 미인식 {pageIdleCount}개 인식
              </button>
            )}
            <span
              className={cn('text-xs text-zinc-500', pageIdleCount === 0 && 'ml-auto')}
            >
              이 페이지 {pageBoxCount}개 · 저장 {savedCount}/{s.boxes.length}
            </span>
          </div>
          {s.figureCapture && (
            <p className="rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-medium text-violet-700">
              ✂️ 그림 캡처 모드 — 본문에서 영역을 드래그하면 선택한 문제의 그림으로 추가돼요.
              (박스 그리기는 잠시 멈춤)
            </p>
          )}
          <PdfBoxViewer
            doc={s.doc}
            pageNum={s.pageNum}
            rotation={s.pageRotations[s.pageNum] ?? 0}
            zoom={zoom}
            boxes={s.boxes}
            selectedId={s.selectedId}
            onSelect={s.setSelectedId}
            onDelete={(id) => void deleteBox(id)}
            onCreate={(r) => void onCreate(r)}
            onRecognize={(id) => void recognizeBox(id)}
            onUpdateRect={(id, rect) => patchBox(id, { rect })}
            canvasRef={canvasRef}
            captureMode={s.figureCapture}
            onCaptureFigure={(r) => void captureFigureFromMain(r)}
          />
        </section>

        {/* 보조 뷰어 (답안/해설/부가자료 참조) */}
        {s.refDoc && (
          <section className="min-w-0 space-y-2">
            <PdfRefViewer
              key={s.refSel?.type === 'attachment' ? s.refSel.id : 'same'}
              doc={s.refDoc}
              pageRotations={refPageRotations}
              grabbing={s.grabbing}
              onGrab={(g) => void grabFromRef(g, activeChildSafe)}
              onRotate={(d, p) => void rotateRef(d, p)}
              onReset={() => void resetRotation('ref')}
              linkedRefs={linkedRefs}
              labelChildren={isSet}
              activeChild={activeChildSafe}
              onUpdateLinkedRef={(refId, rect) => {
                if (selected) updateAnswerRefRect(selected.id, refId, rect);
              }}
              onDeleteLinkedRef={(refId) => {
                if (selected) removeAnswerRef(selected.id, refId);
              }}
            />
          </section>
        )}

        {/* 편집 패널 */}
        <section className="min-w-0 space-y-3">
          {!selected ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
              종류(문제/문제 세트/개념/본문)를 고르고 왼쪽에서 영역을 드래그하세요.
              <br />
              지문 하나에 문제가 여러 개면 “문제 세트”로 잡으면 한 박스에 묶여요.
              <br />
              박스를 클릭하면 여기서 수정할 수 있어요. 박스를 끌어 옮기거나 모서리로 크기를
              조절할 수 있어요.
            </div>
          ) : selected.status === 'idle' ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
              <p>영역만 잡았어요. 인식을 누르면 종류를 자동 분류하고 내용을 채워요.</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void recognizeBox(selected.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-bold text-white hover:bg-zinc-800"
                >
                  <Sparkles className="h-4 w-4" /> 인식
                </button>
                <button
                  type="button"
                  onClick={() => void deleteBox(selected.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" /> 취소
                </button>
              </div>
            </div>
          ) : selected.status === 'ocr' ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> 영역 인식 중…
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 rounded-lg border px-3 py-2 text-xs font-medium',
                  selected.status === 'saved'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : selected.status === 'failed'
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-zinc-200 bg-white text-zinc-600',
                )}
              >
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="whitespace-nowrap">
                    p.{selected.page} · {KIND_LABEL[selected.kind]}
                  </span>
                  <span className="truncate">
                    {selected.status === 'saved'
                      ? '저장됨 ✓'
                      : selected.status === 'failed'
                        ? '인식 실패'
                        : ''}
                  </span>
                  {(selected.tokensIn > 0 || selected.tokensOut > 0) && (
                    <span
                      className="shrink-0 whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-amber-700"
                      title="이 항목 인식에 쓴 토큰"
                    >
                      🪙↑{fmtTok(selected.tokensIn)} ↓{fmtTok(selected.tokensOut)}
                    </span>
                  )}
                  {selected.actor && (
                    <span
                      className="shrink-0 truncate text-[10px] font-normal text-zinc-400"
                      title="올린 사람"
                    >
                      · {selected.actor}
                    </span>
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void deleteBox(selected.id)}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-500 hover:bg-rose-50 hover:text-rose-600"
                    title="이 박스 삭제 (저장된 문제·교재가 있으면 함께 삭제)"
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" /> 삭제
                  </button>
                  <button
                    type="button"
                    onClick={() => void reocrSelected()}
                    disabled={selected.id.startsWith('temp-')}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
                    title="왼쪽 본문에서 이 박스(문제) 영역을 다시 인식 — 발문·보기 등"
                  >
                    <ScanText className="h-3.5 w-3.5 shrink-0" />{' '}
                    {selected.kind === 'problem' || selected.kind === 'problemset'
                      ? '문제 다시 인식'
                      : '내용 다시 인식'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveSelected()}
                    disabled={s.saving}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {s.saving ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {isSet
                      ? `세트 저장 ${childCount}`
                      : selected.status === 'saved'
                        ? '다시 저장'
                        : '저장'}
                  </button>
                </div>
              </div>

              {selected.kind === 'problemset' && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-2 text-xs text-fuchsia-700">
                  <span className="font-medium">문항 수</span>
                  <div className="inline-flex items-center overflow-hidden rounded-md border border-fuchsia-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setSplitN((n) => Math.max(1, n - 1))}
                      className="px-2 py-1 font-bold text-fuchsia-700 hover:bg-fuchsia-100"
                    >
                      −
                    </button>
                    <span className="min-w-[1.75rem] text-center font-semibold tabular-nums">
                      {splitN}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSplitN((n) => Math.min(20, n + 1))}
                      className="px-2 py-1 font-bold text-fuchsia-700 hover:bg-fuchsia-100"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={selected.id.startsWith('temp-') || s.saving}
                    onClick={() => void resplitSelected(splitN)}
                    className="inline-flex items-center gap-1 rounded-md bg-fuchsia-600 px-2 py-1 font-medium text-white hover:bg-fuchsia-700 disabled:opacity-40"
                    title="정확히 이 개수의 문항으로 다시 나눠 인식"
                  >
                    <Scissors className="h-3.5 w-3.5" /> 이 수로 나눠 인식
                  </button>
                  <span className="text-fuchsia-500/80">
                    세트가 한 문제로 합쳐졌을 때 문항 수를 지정해 다시 나눠요.
                  </span>
                </div>
              )}

              {(selected.kind === 'problem' || selected.kind === 'problemset') &&
                (selected.answerRefs.length > 0 || isSet) && (
                  <div className="space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {/* 세트: 풀이를 받을 자식 문제 선택 (보조 뷰어 grab 대상) */}
                    {isSet && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="mr-0.5 font-medium">풀이 받을 문제:</span>
                        {Array.from({ length: childCount }).map((_, i) => {
                          const linked = selected.answerRefs.some((a) => a.childIndex === i);
                          const active = i === activeChildSafe;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setActiveChild(i)}
                              title={linked ? '해설 연결됨' : '아직 해설 연결 없음'}
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[11px] font-medium transition',
                                active
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100',
                              )}
                            >
                              문제 {i + 1}
                              {linked ? ' ✓' : ''}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-medium">
                        🔗 {isSet ? `문제 ${activeChildSafe + 1} ` : ''}답안 연결 {childRefs.length}곳
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          disabled={s.grabbing || childRefs.length === 0}
                          onClick={() => void rescanAnswerRefs(selected.id, activeChildSafe)}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
                          title="연결된 해설 영역을 다시 스캔해 정답·해설을 새로 채움"
                        >
                          {s.grabbing ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                          )}
                          해설 다시 스캔
                        </button>
                        <button
                          type="button"
                          disabled={childRefs.length === 0}
                          onClick={() =>
                            clearAnswerRefs(selected.id, isSet ? activeChildSafe : undefined)
                          }
                          className="rounded px-1.5 py-0.5 font-medium hover:bg-emerald-100 disabled:opacity-40"
                        >
                          {isSet ? '이 문제 해제' : '전체 해제'}
                        </button>
                      </div>
                    </div>
                    {childRefs.length === 0 ? (
                      <p className="text-[11px] text-emerald-600/80">
                        보조 뷰어에서 {isSet ? `문제 ${activeChildSafe + 1}의 ` : ''}정답·해설 영역을
                        잡으면 여기에 연결돼요.
                      </p>
                    ) : (
                      childRefs.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-1">
                          <span className="truncate">
                            {s.attachments.find((x) => x.id === a.attachmentId)?.title ??
                              '삭제된 부속'}{' '}
                            · p.{a.page}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAnswerRef(selected.id, a.id)}
                            className="shrink-0 rounded px-1.5 py-0.5 hover:bg-emerald-100"
                            title="이 연결 해제"
                          >
                            해제
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                {selected.kind === 'problem' || selected.kind === 'problemset' ? (
                  <WorkbenchProblemForm
                    subject={s.source.subject}
                    value={selected.problem}
                    onChange={(next) => patchBox(selected.id, { problem: next })}
                    uploadFigure={uploadFigureFile}
                    isSet={isSet}
                    activeChild={activeChildSafe}
                    onActiveChild={setActiveChild}
                    onRescanChild={(idx) => void rescanAnswerRefs(selected.id, idx)}
                    childRefCounts={Array.from(
                      { length: childCount },
                      (_, i) => selected.answerRefs.filter((a) => a.childIndex === i).length,
                    )}
                    grabbing={s.grabbing}
                  />
                ) : (
                  <div className="space-y-4">
                    <TopicPicker
                      subject={s.source.subject}
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
                    <FiguresEditor
                      figures={selected.chunk.figures}
                      onChange={(figures) =>
                        patchBox(selected.id, { chunk: { ...selected.chunk, figures } })
                      }
                      uploadFigure={uploadFigureFile}
                      hint="개념·본문에 딸린 그림/도표. 보조 뷰어 “그림” 모드로 가져오거나 직접 올리세요."
                    />
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
