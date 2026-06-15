/**
 * 캔버스 위 사각형 선택 드래그 상태 머신 — 메인 뷰어(PdfBoxViewer)와
 * 보조 뷰어(PdfRefViewer)가 공유. 좌표는 캔버스 내부 px.
 */
export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type Bound = { w: number; h: number };

export type DragState =
  | { kind: 'create'; start: Pt; rect: Rect }
  | { kind: 'move'; id?: string; startPos: Pt; orig: Rect; rect: Rect }
  | { kind: 'resize'; id?: string; handle: Handle; startPos: Pt; orig: Rect; rect: Rect };

export const MIN_W = 24;
export const MIN_H = 16;
/** 보조 뷰어 선택의 최소 크기(작은 글자 영역도 잡도록). */
export const MIN_SEL = 8;

export const HANDLES: { h: Handle; cls: string; cursor: string }[] = [
  { h: 'nw', cls: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'nwse-resize' },
  { h: 'n', cls: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'ns-resize' },
  { h: 'ne', cls: 'right-0 top-0 translate-x-1/2 -translate-y-1/2', cursor: 'nesw-resize' },
  { h: 'e', cls: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  { h: 'se', cls: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2', cursor: 'nwse-resize' },
  { h: 's', cls: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2', cursor: 'ns-resize' },
  { h: 'sw', cls: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2', cursor: 'nesw-resize' },
  { h: 'w', cls: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
];

/** 핸들 드래그 → 변 이동, 경계·최소크기 클램프, 변 교차 방지. */
export function applyResize(
  orig: Rect,
  handle: Handle,
  dx: number,
  dy: number,
  bnd: Bound,
  min: { w: number; h: number },
): Rect {
  let left = orig.x;
  let top = orig.y;
  let right = orig.x + orig.w;
  let bottom = orig.y + orig.h;
  if (handle.includes('w')) left = Math.min(Math.max(0, orig.x + dx), right - min.w);
  if (handle.includes('e')) right = Math.max(Math.min(bnd.w, orig.x + orig.w + dx), left + min.w);
  if (handle.includes('n')) top = Math.min(Math.max(0, orig.y + dy), bottom - min.h);
  if (handle.includes('s'))
    bottom = Math.max(Math.min(bnd.h, orig.y + orig.h + dy), top + min.h);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** 이동 → 캔버스 경계 안으로 클램프. */
export function clampMove(orig: Rect, dx: number, dy: number, bnd: Bound): Rect {
  const x = Math.min(Math.max(0, orig.x + dx), Math.max(0, bnd.w - orig.w));
  const y = Math.min(Math.max(0, orig.y + dy), Math.max(0, bnd.h - orig.h));
  return { x, y, w: orig.w, h: orig.h };
}

function createRect(start: Pt, p: Pt): Rect {
  return {
    x: Math.min(start.x, p.x),
    y: Math.min(start.y, p.y),
    w: Math.abs(p.x - start.x),
    h: Math.abs(p.y - start.y),
  };
}

// ---------- 보조 뷰어 단일 선택 reducer ----------
export type SelectionState = { drag: DragState | null; rect: Rect | null };
export type SelectionAction =
  | { type: 'createStart'; p: Pt }
  | { type: 'moveStart'; p: Pt; rect: Rect }
  | { type: 'resizeStart'; p: Pt; handle: Handle; rect: Rect }
  | { type: 'drag'; p: Pt; bound: Bound }
  | { type: 'end' }
  | { type: 'clear' };

export function selectionReducer(
  state: SelectionState,
  action: SelectionAction,
): SelectionState {
  switch (action.type) {
    case 'createStart':
      return { drag: { kind: 'create', start: action.p, rect: { x: action.p.x, y: action.p.y, w: 0, h: 0 } }, rect: null };
    case 'moveStart':
      return { ...state, drag: { kind: 'move', startPos: action.p, orig: action.rect, rect: action.rect } };
    case 'resizeStart':
      return {
        ...state,
        drag: { kind: 'resize', handle: action.handle, startPos: action.p, orig: action.rect, rect: action.rect },
      };
    case 'drag': {
      const d = state.drag;
      if (!d) return state;
      const min = { w: MIN_SEL, h: MIN_SEL };
      if (d.kind === 'create') return { ...state, drag: { ...d, rect: createRect(d.start, action.p) } };
      if (d.kind === 'move')
        return { ...state, drag: { ...d, rect: clampMove(d.orig, action.p.x - d.startPos.x, action.p.y - d.startPos.y, action.bound) } };
      return {
        ...state,
        drag: { ...d, rect: applyResize(d.orig, d.handle, action.p.x - d.startPos.x, action.p.y - d.startPos.y, action.bound, min) },
      };
    }
    case 'end': {
      const d = state.drag;
      if (!d) return state;
      if (d.kind === 'create') return { drag: null, rect: d.rect.w >= MIN_SEL ? d.rect : null };
      return { drag: null, rect: d.rect };
    }
    case 'clear':
      return { drag: null, rect: null };
    default:
      return state;
  }
}
