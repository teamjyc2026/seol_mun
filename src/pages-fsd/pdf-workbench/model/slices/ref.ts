import type { StateCreator } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Attachment, RefSel } from '../types';
import type { WorkbenchState } from '../store';

/** 보조 뷰어 (부속 PDF·같은 PDF 참조). */
export type RefSlice = {
  attachments: Attachment[];
  refSel: RefSel;
  refDoc: PDFDocumentProxy | null;
  grabbing: boolean;

  setAttachments: (atts: Attachment[]) => void;
  appendAttachment: (att: Attachment) => void;
  removeAttachment: (id: string) => void;
  setRefSel: (sel: RefSel) => void;
  setRefDoc: (doc: PDFDocumentProxy | null) => void;
  setGrabbing: (v: boolean) => void;
  clearRef: () => void;
};

export const createRefSlice: StateCreator<WorkbenchState, [], [], RefSlice> = (
  set,
) => ({
  attachments: [],
  refSel: null,
  refDoc: null,
  grabbing: false,

  setAttachments: (attachments) => set({ attachments }),
  appendAttachment: (att) =>
    set((s) => ({ attachments: [...s.attachments, att] })),
  removeAttachment: (id) =>
    set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })),
  setRefSel: (refSel) => set({ refSel }),
  setRefDoc: (refDoc) => set({ refDoc }),
  setGrabbing: (grabbing) => set({ grabbing }),
  clearRef: () => set({ refSel: null, refDoc: null }),
});
