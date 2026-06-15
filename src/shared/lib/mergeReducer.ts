import { useReducer } from 'react';

/**
 * 얕은 병합 리듀서 — 여러 useState를 하나의 상태 객체 + set(patch)로 대체한다.
 * 폼처럼 서로 묶인 필드가 많을 때 useState 떡칠 대신 사용.
 *
 *   const [state, set] = useMergeState({ name: '', busy: false });
 *   set({ name: 'a' });            // 한 필드
 *   set({ name: 'a', busy: true }); // 여러 필드 한 번에
 */
export function useMergeState<S extends object>(initial: S | (() => S)) {
  return useReducer(
    (s: S, patch: Partial<S>): S => ({ ...s, ...patch }),
    undefined as never,
    () => (typeof initial === 'function' ? (initial as () => S)() : initial),
  );
}
