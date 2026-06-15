'use client';

import { useEffect, useState } from 'react';

type Endpoints = { fx: number; fy: number; tx: number; ty: number };

/**
 * 메인 뷰어의 선택된 박스 → 보조 뷰어의 연결된 답 영역을 잇는 선.
 * rAF 루프로 두 엘리먼트의 위치를 추적 — 스크롤·리사이즈·페이지 전환·
 * 캔버스 렌더 완료(레이아웃 변경)에 자동으로 따라간다.
 * 둘 중 하나라도 화면에 없으면(다른 페이지 등) 선을 숨긴다.
 */
export function ConnectionLine({
  containerRef,
  fromSelector,
  toSelector,
  active,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  fromSelector: string;
  toSelector: string;
  active: boolean;
}) {
  const [pts, setPts] = useState<Endpoints | null>(null);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const container = containerRef.current;
      const from = container?.querySelector(fromSelector);
      const to = container?.querySelector(toSelector);
      if (!container || !from || !to) {
        setPts((cur) => (cur === null ? cur : null));
      } else {
        const c = container.getBoundingClientRect();
        const f = from.getBoundingClientRect();
        const t = to.getBoundingClientRect();
        const next: Endpoints = {
          fx: f.right - c.left,
          fy: f.top + f.height / 2 - c.top,
          tx: t.left - c.left,
          ty: t.top + t.height / 2 - c.top,
        };
        setPts((cur) =>
          cur &&
          Math.abs(cur.fx - next.fx) < 0.5 &&
          Math.abs(cur.fy - next.fy) < 0.5 &&
          Math.abs(cur.tx - next.tx) < 0.5 &&
          Math.abs(cur.ty - next.ty) < 0.5
            ? cur
            : next,
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setPts(null);
    };
  }, [active, containerRef, fromSelector, toSelector]);

  if (!active || !pts) return null;
  const { fx, fy, tx, ty } = pts;
  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
      <path
        d={`M ${fx} ${fy} C ${fx + 60} ${fy}, ${tx - 60} ${ty}, ${tx} ${ty}`}
        fill="none"
        stroke="#6366f1"
        strokeWidth={2}
        strokeDasharray="6 4"
      />
      <circle cx={fx} cy={fy} r={4} fill="#6366f1" />
      <circle cx={tx} cy={ty} r={4} fill="#6366f1" />
    </svg>
  );
}
