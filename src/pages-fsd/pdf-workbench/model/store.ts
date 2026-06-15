'use client';

import { create } from 'zustand';
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
  };

/**
 * 워크벤치 전역 스토어 — 슬라이스 합성. 서버에서 로드되는 휘발성 상태라
 * persist 없이 메모리에만 둔다(PDFDocumentProxy·File 등 비직렬화 값 포함).
 */
export const useWorkbenchStore = create<WorkbenchState>()((...a) => {
  const [set] = a;
  return {
    ...createCreationSlice(...a),
    ...createSessionSlice(...a),
    ...createBoxSlice(...a),
    ...createRefSlice(...a),
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
        rotation: 0,
        tokensIn: 0,
        tokensOut: 0,
        boxes: [],
        selectedId: null,
        saving: false,
        attachments: [],
        refSel: null,
        refDoc: null,
        grabbing: false,
      }),
  };
});
