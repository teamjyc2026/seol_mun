'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createCreationSlice, type CreationSlice } from './slices/creation';
import { createSessionSlice, type SessionSlice } from './slices/session';
import { createBoxSlice, type BoxSlice } from './slices/box';
import { createRefSlice, type RefSlice } from './slices/ref';

export type WorkbenchState = CreationSlice &
  SessionSlice &
  BoxSlice &
  RefSlice & {
    /** 페이지 진입 시 전체 초기화 (모듈 전역 싱글턴이라 직접 비운다). */
    resetAll: () => void;
    /**
     * 마지막으로 연 작업 id — 유일하게 persist되는 값. 워크벤치 재진입 시
     * 자동으로 그 작업을 다시 연다(나머지 doc/source는 서버에서 재로드).
     */
    lastJobId: string | null;
    setLastJobId: (id: string | null) => void;
  };

/**
 * 워크벤치 전역 스토어 — 슬라이스 합성. 세션 상태는 서버에서 로드되는 휘발성
 * 값(PDFDocumentProxy·File 등 비직렬화)이라 persist하지 않고, 어디까지 작업했는지
 * 기억하도록 lastJobId만 localStorage에 persist한다.
 */
export const useWorkbenchStore = create<WorkbenchState>()(
  persist(
    (...a) => {
      const [set] = a;
      return {
        ...createCreationSlice(...a),
        ...createSessionSlice(...a),
        ...createBoxSlice(...a),
        ...createRefSlice(...a),
        lastJobId: null,
        setLastJobId: (lastJobId) => set({ lastJobId }),
        resetAll: () =>
          set({
        creating: false,
        pendingFile: null,
        pendingAttachments: [],
        title: '',
        uploading: false,
        uploadPct: 0,
        uploadStep: '',
        currentFolderId: null,
        jobId: null,
        jobTitle: '',
        source: null,
        doc: null,
        opening: false,
        pageNum: 1,
        numPages: 0,
        pageRotations: {},
        tokensIn: 0,
        tokensOut: 0,
        embedPending: { problems: 0, chunks: 0 },
        embedRunning: false,
        boxes: [],
        selectedId: null,
        saving: false,
        figureCapture: false,
        attachments: [],
        refSel: null,
        refDoc: null,
        grabbing: false,
      }),
      };
    },
    {
      name: 'seolmun-workbench',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lastJobId: s.lastJobId }),
    },
  ),
);
