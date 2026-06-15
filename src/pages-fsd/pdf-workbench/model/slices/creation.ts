import type { StateCreator } from 'zustand';
import type { Subject } from '@/shared/config/subjects';
import type { Folder, JobSummary, PendingAttachment } from '../types';
import type { WorkbenchState } from '../store';

/** 목록 폴더 필터 — null=전체, 'unfiled'=미분류, string=특정 폴더 id. */
export type FolderFilter = string | 'unfiled' | null;

/** 목록 / 새 작업 생성 폼 상태. */
export type CreationSlice = {
  jobs: JobSummary[];
  jobsLoading: boolean;
  /** 목록 과목 필터 (null = 전체). */
  jobSubjectFilter: Subject | null;
  folders: Folder[];
  folderFilter: FolderFilter;
  creating: boolean;
  pendingFile: File | null;
  pendingAttachments: PendingAttachment[];
  title: string;
  subject: Subject;
  grade: string;
  sourceType: string;
  publisher: string;
  uploading: boolean;
  uploadPct: number;
  uploadStep: string;

  setJobs: (jobs: JobSummary[]) => void;
  setJobsLoading: (v: boolean) => void;
  setJobSubjectFilter: (s: Subject | null) => void;
  setFolders: (f: Folder[]) => void;
  setFolderFilter: (f: FolderFilter) => void;
  setCreating: (v: boolean) => void;
  setPendingFile: (f: File | null) => void;
  addPendingAttachments: (atts: PendingAttachment[]) => void;
  removePendingAttachment: (index: number) => void;
  setPendingAttachmentTitle: (index: number, title: string) => void;
  setTitle: (v: string) => void;
  setSubject: (v: Subject) => void;
  setGrade: (v: string) => void;
  setSourceType: (v: string) => void;
  setPublisher: (v: string) => void;
  setUploading: (v: boolean) => void;
  setUploadPct: (v: number) => void;
  setUploadStep: (v: string) => void;
  resetCreationForm: () => void;
};

export const createCreationSlice: StateCreator<
  WorkbenchState,
  [],
  [],
  CreationSlice
> = (set) => ({
  jobs: [],
  jobsLoading: true,
  jobSubjectFilter: null,
  folders: [],
  folderFilter: null,
  creating: false,
  pendingFile: null,
  pendingAttachments: [],
  title: '',
  subject: '영어',
  grade: '고1',
  sourceType: '문제집',
  publisher: '',
  uploading: false,
  uploadPct: 0,
  uploadStep: '',

  setJobs: (jobs) => set({ jobs }),
  setJobsLoading: (jobsLoading) => set({ jobsLoading }),
  setJobSubjectFilter: (jobSubjectFilter) => set({ jobSubjectFilter }),
  setFolders: (folders) => set({ folders }),
  setFolderFilter: (folderFilter) => set({ folderFilter }),
  setCreating: (creating) => set({ creating }),
  setPendingFile: (pendingFile) => set({ pendingFile }),
  addPendingAttachments: (atts) =>
    set((s) => ({ pendingAttachments: [...s.pendingAttachments, ...atts] })),
  removePendingAttachment: (index) =>
    set((s) => ({
      pendingAttachments: s.pendingAttachments.filter((_, i) => i !== index),
    })),
  setPendingAttachmentTitle: (index, title) =>
    set((s) => ({
      pendingAttachments: s.pendingAttachments.map((a, i) =>
        i === index ? { ...a, title } : a,
      ),
    })),
  setTitle: (title) => set({ title }),
  setSubject: (subject) => set({ subject }),
  setGrade: (grade) => set({ grade }),
  setSourceType: (sourceType) => set({ sourceType }),
  setPublisher: (publisher) => set({ publisher }),
  setUploading: (uploading) => set({ uploading }),
  setUploadPct: (uploadPct) => set({ uploadPct }),
  setUploadStep: (uploadStep) => set({ uploadStep }),
  resetCreationForm: () =>
    set({
      creating: false,
      pendingFile: null,
      pendingAttachments: [],
      title: '',
      uploading: false,
      uploadPct: 0,
      uploadStep: '',
    }),
});
