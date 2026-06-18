import type { StateCreator } from 'zustand';
import type { BoxKind } from '../../ui/PdfBoxViewer';
import type { BoxData } from '../types';
import type { WorkbenchState } from '../store';

/** 작업판 박스 + 선택/그리기 상태. */
export type BoxSlice = {
  boxes: BoxData[];
  selectedId: string | null;
  drawKind: BoxKind;
  saving: boolean;
  /** 메인 뷰어 드래그가 박스 생성 대신 선택 문제의 그림을 캡처하는 모드. */
  figureCapture: boolean;
  /** 메인 뷰어 드래그가 선택 문제에 "이어붙일 영역"을 추가하는 모드. */
  partCapture: boolean;

  setBoxes: (boxes: BoxData[]) => void;
  addBox: (box: BoxData) => void;
  /** 순수 로컬 갱신 (서버 동기화는 컨트롤러의 patchBox가 담당). */
  updateBox: (id: string, patch: Partial<BoxData>) => void;
  removeBox: (id: string) => void;
  swapBoxId: (tempId: string, serverId: string) => void;
  setSelectedId: (id: string | null) => void;
  setDrawKind: (kind: BoxKind) => void;
  setSaving: (v: boolean) => void;
  setFigureCapture: (v: boolean) => void;
  setPartCapture: (v: boolean) => void;
};

export const createBoxSlice: StateCreator<WorkbenchState, [], [], BoxSlice> = (
  set,
) => ({
  boxes: [],
  selectedId: null,
  drawKind: 'problem',
  saving: false,
  figureCapture: false,
  partCapture: false,

  setBoxes: (boxes) => set({ boxes }),
  addBox: (box) => set((s) => ({ boxes: [...s.boxes, box] })),
  updateBox: (id, patch) =>
    set((s) => ({
      boxes: s.boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })),
  removeBox: (id) =>
    set((s) => ({
      boxes: s.boxes.filter((b) => b.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),
  swapBoxId: (tempId, serverId) =>
    set((s) => ({
      boxes: s.boxes.map((b) => (b.id === tempId ? { ...b, id: serverId } : b)),
      selectedId: s.selectedId === tempId ? serverId : s.selectedId,
    })),
  setSelectedId: (selectedId) => set({ selectedId }),
  setDrawKind: (drawKind) => set({ drawKind }),
  setSaving: (saving) => set({ saving }),
  setFigureCapture: (figureCapture) => set({ figureCapture }),
  setPartCapture: (partCapture) => set({ partCapture }),
});
