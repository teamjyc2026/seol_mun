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

  setBoxes: (boxes: BoxData[]) => void;
  addBox: (box: BoxData) => void;
  /** 순수 로컬 갱신 (서버 동기화는 컨트롤러의 patchBox가 담당). */
  updateBox: (id: string, patch: Partial<BoxData>) => void;
  removeBox: (id: string) => void;
  swapBoxId: (tempId: string, serverId: string) => void;
  setSelectedId: (id: string | null) => void;
  setDrawKind: (kind: BoxKind) => void;
  setSaving: (v: boolean) => void;
};

export const createBoxSlice: StateCreator<WorkbenchState, [], [], BoxSlice> = (
  set,
) => ({
  boxes: [],
  selectedId: null,
  drawKind: 'problem',
  saving: false,

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
});
