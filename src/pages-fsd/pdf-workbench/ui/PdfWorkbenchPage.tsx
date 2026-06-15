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
  Trash2,
} from 'lucide-react';
import { api } from '@/shared/api/axios';
import { SUBJECTS } from '@/shared/config/subjects';
import { cn } from '@/shared/lib/cn';
import { PdfBoxViewer, KIND_LABEL, type BoxKind } from './PdfBoxViewer';
import { ConnectionLine } from './ConnectionLine';
import { PdfRefViewer } from './PdfRefViewer';
import { TopicPicker } from './TopicPicker';
import { WorkbenchProblemForm } from './WorkbenchProblemForm';
import { useWorkbenchController, useWorkbenchStore } from '../model';

const SOURCE_TYPES = ['교과서', '문제집', '기출', '요약본', '강의자료', '기타'];
const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];

const KIND_ICON: Record<BoxKind, typeof PencilLine> = {
  problem: PencilLine,
  concept: Lightbulb,
  passage: BookOpen,
};

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
    deleteFolder,
    moveJob,
    openJob,
    closeJob,
    refreshBoxes,
    startNewJob,
    patchBox,
    rotateJob,
    onCreate,
    reocrSelected,
    deleteBox,
    saveSelected,
    toggleSameRef,
    openAttachment,
    addAttachment,
    deleteAttachment,
    grabAnswer,
  } = useWorkbenchController();

  const s = useWorkbenchStore(
    useShallow((st) => ({
      // 목록 / 생성 폼
      jobs: st.jobs,
      jobsLoading: st.jobsLoading,
      jobSubjectFilter: st.jobSubjectFilter,
      folders: st.folders,
      folderFilter: st.folderFilter,
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
      rotation: st.rotation,
      // 박스
      boxes: st.boxes,
      selectedId: st.selectedId,
      drawKind: st.drawKind,
      saving: st.saving,
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
      setFolderFilter: st.setFolderFilter,
      setDrawKind: st.setDrawKind,
      setPage: st.setPage,
      setSelectedId: st.setSelectedId,
    })),
  );

  /** 드래그 호버 표시 (순수 UI). */
  const [dragZone, setDragZone] = useState<'main' | 'attach' | null>(null);

  const selected = s.boxes.find((b) => b.id === s.selectedId) ?? null;
  /** 선택된 박스의 링크가 현재 열린 부속 PDF를 가리킬 때만 보조 뷰어에 표시. */
  const linkedRef =
    selected?.answerRef &&
    s.refSel?.type === 'attachment' &&
    selected.answerRef.attachmentId === s.refSel.id
      ? { page: selected.answerRef.page, rect: selected.answerRef.rect }
      : null;
  useEffect(() => {
    useWorkbenchStore.getState().resetAll();
    void refreshJobs();
    void refreshFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pageBoxCount = s.boxes.filter((b) => b.page === s.pageNum).length;
  const savedCount = s.boxes.filter((b) => b.status === 'saved').length;
  const visibleJobs = s.jobs.filter((j) => {
    if (s.jobSubjectFilter && j.subject !== s.jobSubjectFilter) return false;
    if (s.folderFilter === 'unfiled' && j.folder_id) return false;
    if (s.folderFilter && s.folderFilter !== 'unfiled' && j.folder_id !== s.folderFilter)
      return false;
    return true;
  });

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
          <button
            type="button"
            onClick={() => s.setCreating(!s.creating)}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white"
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

        {/* 폴더 필터 */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <FolderIcon className="h-3.5 w-3.5 text-zinc-400" />
          <button
            type="button"
            onClick={() => s.setFolderFilter(null)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
              s.folderFilter === null
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
            )}
          >
            전체
          </button>
          <button
            type="button"
            onClick={() => s.setFolderFilter('unfiled')}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
              s.folderFilter === 'unfiled'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
            )}
          >
            미분류
          </button>
          {s.folders.map((f) => {
            const active = s.folderFilter === f.id;
            return (
              <span
                key={f.id}
                className={cn(
                  'inline-flex items-center overflow-hidden rounded-full border text-xs font-medium transition',
                  active
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-zinc-200 bg-white text-zinc-600',
                )}
              >
                <button
                  type="button"
                  onClick={() => s.setFolderFilter(f.id)}
                  className={cn('px-2.5 py-0.5', !active && 'hover:bg-zinc-50')}
                >
                  {f.name} {f.jobCount}
                </button>
                {active && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const name = prompt('폴더 이름', f.name);
                        if (name?.trim()) void renameFolder(f.id, name);
                      }}
                      className="border-l border-indigo-200 px-1 py-0.5 hover:bg-indigo-100"
                      title="이름 변경"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`'${f.name}' 폴더를 삭제할까요? (작업은 미분류로)`))
                          void deleteFolder(f.id);
                      }}
                      className="border-l border-indigo-200 px-1 py-0.5 text-rose-500 hover:bg-rose-50"
                      title="삭제"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => {
              const name = prompt('새 폴더 이름');
              if (name?.trim()) void createFolder(name);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-zinc-500 hover:border-indigo-300 hover:text-indigo-600"
          >
            <Plus className="h-3 w-3" /> 새 폴더
          </button>
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

        <section className="space-y-2">
          {s.jobsLoading ? (
            <div className="grid h-28 place-items-center rounded-xl border border-zinc-200 bg-white text-sm text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : visibleJobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
              {s.jobs.length === 0
                ? '아직 작업이 없어요. "새 작업"으로 PDF를 올려 시작하세요.'
                : '이 과목의 작업이 없어요.'}
            </div>
          ) : (
            visibleJobs.map((j) => (
              <div
                key={j.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
              >
                <Scissors className="h-4 w-4 shrink-0 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900">{j.title}</p>
                  <p className="text-xs text-zinc-500">
                    {[j.subject, j.grade].filter(Boolean).join(' · ')}
                    {j.attachmentCount > 0 ? ` · 부속 PDF ${j.attachmentCount}개` : ''} · 박스{' '}
                    {j.boxCount}개 (저장 {j.savedCount}) ·{' '}
                    {new Date(j.updated_at).toLocaleString('ko-KR')}
                  </p>
                </div>
                <select
                  value={j.folder_id ?? ''}
                  onChange={(e) => void moveJob(j.id, e.target.value || null)}
                  title="폴더 이동"
                  className="hidden h-8 max-w-28 rounded-md border border-zinc-200 bg-white px-1 text-xs text-zinc-600 sm:block"
                >
                  <option value="">미분류</option>
                  {s.folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
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

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-xs text-zinc-500">새 박스:</span>
          {(Object.keys(KIND_LABEL) as BoxKind[]).map((k) => {
            const Icon = KIND_ICON[k];
            const active = s.drawKind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => s.setDrawKind(k)}
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
          active={!!linkedRef && !!s.refDoc}
          fromSelector={`[data-box-id="${s.selectedId}"]`}
          toSelector="[data-answer-link]"
        />
        {/* 메인 뷰어 */}
        <section className="space-y-2">
          <div className="flex h-8 items-center gap-2 text-sm">
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
              title="왼쪽으로 90° 회전"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void rotateJob(90)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              title="오른쪽으로 90° 회전"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <span className="ml-auto text-xs text-zinc-500">
              이 페이지 {pageBoxCount}개 · 저장 {savedCount}/{s.boxes.length}
            </span>
          </div>
          <PdfBoxViewer
            doc={s.doc}
            pageNum={s.pageNum}
            rotation={s.rotation}
            boxes={s.boxes}
            selectedId={s.selectedId}
            onSelect={s.setSelectedId}
            onDelete={(id) => void deleteBox(id)}
            onCreate={(r) => void onCreate(r)}
            onUpdateRect={(id, rect) => patchBox(id, { rect })}
            canvasRef={canvasRef}
          />
        </section>

        {/* 보조 뷰어 (답안/해설/부가자료 참조) */}
        {s.refDoc && (
          <section className="space-y-2">
            <PdfRefViewer
              key={s.refSel?.type === 'attachment' ? s.refSel.id : 'same'}
              doc={s.refDoc}
              grabbing={s.grabbing}
              grabLabel="→ 정답·해설 가져오기"
              onGrab={(g) => void grabAnswer(g)}
              linkedRef={linkedRef}
            />
          </section>
        )}

        {/* 편집 패널 */}
        <section className="space-y-3">
          {!selected ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
              종류(문제/개념/본문)를 고르고 왼쪽에서 영역을 드래그하세요.
              <br />
              박스를 클릭하면 여기서 수정할 수 있어요. 박스를 끌어 옮기거나 모서리로 크기를
              조절할 수 있어요.
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
                  'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-medium',
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
                    onChange={(e) => patchBox(selected.id, { kind: e.target.value as BoxKind })}
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
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void reocrSelected()}
                    disabled={selected.id.startsWith('temp-')}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
                    title="영역을 수정한 뒤 이 영역을 다시 인식"
                  >
                    <ScanText className="h-3.5 w-3.5" /> 다시 인식
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveSelected()}
                    disabled={s.saving || selected.status === 'saved'}
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {s.saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    저장
                  </button>
                </div>
              </div>

              {selected.kind === 'problem' && selected.answerRef && (
                <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700">
                  <span>
                    🔗 답안 연결됨 —{' '}
                    {s.attachments.find((a) => a.id === selected.answerRef?.attachmentId)
                      ?.title ?? '삭제된 부속'}{' '}
                    p.{selected.answerRef.page}
                  </span>
                  <button
                    type="button"
                    onClick={() => patchBox(selected.id, { answerRef: null })}
                    className="rounded px-1.5 py-0.5 font-medium hover:bg-indigo-100"
                    title="연결 해제"
                  >
                    해제
                  </button>
                </div>
              )}

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                {selected.kind === 'problem' ? (
                  <WorkbenchProblemForm
                    subject={s.source.subject}
                    value={selected.problem}
                    onChange={(next) => patchBox(selected.id, { problem: next })}
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
