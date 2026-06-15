'use client';

import { useEffect, useState } from 'react';

type Seg = { fx: number; fy: number; tx: number; ty: number };

/**
 * 메인 뷰어의 선택된 박스 → 보조 뷰어의 연결된 답 영역(들)을 잇는 선.
 * rAF 루프로 위치를 추적 — 스크롤·리사이즈·페이지 전환·캔버스 렌더 완료에
 * 자동으로 따라간다. 답 영역이 여러 개면(다대일) 각각에 선을 그린다.
 */
export function ConnectionLine({
  containerRef,
  fromSelector,
  toSelector,
  active,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  fromSelector: string;
  /** 답 영역 셀렉터 — querySelectorAll로 전부 잡아 각각에 선. */
  toSelector: string;
  active: boolean;
}) {
  const [segs, setSegs] = useState<Seg[]>([]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const container = containerRef.current;
      const from = container?.querySelector(fromSelector);
      const tos = container ? Array.from(container.querySelectorAll(toSelector)) : [];
      if (!container || !from || tos.length === 0) {
        setSegs((cur) => (cur.length === 0 ? cur : []));
      } else {
        const c = container.getBoundingClientRect();
        const f = from.getBoundingClientRect();
        const next: Seg[] = tos.map((to) => {
          const t = to.getBoundingClientRect();
          return {
            fx: f.right - c.left,
            fy: f.top + f.height / 2 - c.top,
            tx: t.left - c.left,
            ty: t.top + t.height / 2 - c.top,
          };
        });
        setSegs((cur) => {
          if (
            cur.length === next.length &&
            cur.every(
              (s, i) =>
                Math.abs(s.fx - next[i].fx) < 0.5 &&
                Math.abs(s.fy - next[i].fy) < 0.5 &&
                Math.abs(s.tx - next[i].tx) < 0.5 &&
                Math.abs(s.ty - next[i].ty) < 0.5,
            )
          )
            return cur;
          return next;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setSegs([]);
    };
  }, [active, containerRef, fromSelector, toSelector]);

  if (!active || segs.length === 0) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
      {segs.map((s, i) => (
        <g key={i}>
          <path
            d={`M ${s.fx} ${s.fy} C ${s.fx + 60} ${s.fy}, ${s.tx - 60} ${s.ty}, ${s.tx} ${s.ty}`}
            fill="none"
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          <circle cx={s.fx} cy={s.fy} r={4} fill="#6366f1" />
          <circle cx={s.tx} cy={s.ty} r={4} fill="#6366f1" />
        </g>
      ))}
    </svg>
  );
}
