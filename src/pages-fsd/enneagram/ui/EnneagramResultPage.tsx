'use client';

import Link from 'next/link';
import { TYPES, PER_AREA, CONTACT } from '@/entities/enneagram';
import { C, SHADOW, Bloom, Brand } from './EnneagramApp';

/* ---------- 가려진 결과지 미리보기 ----------
 * 실제 결과(top/sub/scores)는 서버가 내려주지 않으므로(관리자 전용)
 * 더미 데이터를 블러+그라데이션으로 가려 결과지 분위기만 보여준다. */
const DUMMY_BARS = [52, 61, 45, 70, 58, 49, 63, 55, 60];

function BlurredResultPreview() {
  const maxv = PER_AREA * 5;
  return (
    <div className="relative mb-4 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none select-none"
        style={{ filter: 'blur(7px)' }}
      >
        {/* 주요기질 카드 (더미) */}
        <div
          className="mb-4 rounded-2xl p-[22px]"
          style={{
            background: C.card,
            border: `1px solid ${C.line}`,
            boxShadow: SHADOW,
          }}
        >
          <div
            className="mb-[9px] text-[12px] font-bold uppercase tracking-[0.1em]"
            style={{ color: C.coral }}
          >
            주요기질
          </div>
          <div className="flex items-center gap-3">
            <div
              className="grid h-12 w-12 flex-none place-items-center rounded-[13px] text-[20px] font-extrabold text-white"
              style={{ background: C.green, boxShadow: SHADOW }}
            >
              ?
            </div>
            <div>
              <h2 className="text-[22px] font-extrabold tracking-tight">
                ●●●●● 기질
              </h2>
              <div
                className="text-[13.5px] font-semibold"
                style={{ color: C.inkSoft }}
              >
                ●●●● · ●●●●●
              </div>
            </div>
          </div>
          <p className="mt-4 text-[14.5px] leading-[1.6]">
            ●●●●●● ●●●● ●●●●●●●● ●●● ●●●●●● ●●●● ●●●●● ●●●●●●● ●●●● ●●●●●●
            ●●●●● ●●●●.
          </p>
        </div>

        {/* 유형별 점수 (더미 막대) */}
        <div
          className="rounded-2xl p-[22px]"
          style={{
            background: C.card,
            border: `1px solid ${C.line}`,
            boxShadow: SHADOW,
          }}
        >
          <div
            className="mb-3 text-[12px] font-bold uppercase tracking-[0.1em]"
            style={{ color: C.coral }}
          >
            유형별 점수
          </div>
          <div className="flex w-full flex-col gap-2">
            {DUMMY_BARS.map((v, i) => {
              const t = i + 1;
              const w = Math.round((v / maxv) * 100);
              return (
                <div key={t} className="flex items-center gap-[10px] text-[13px]">
                  <div className="flex w-[112px] flex-none items-center gap-[7px] font-semibold">
                    <span
                      className="h-[9px] w-[9px] flex-none rounded-[3px]"
                      style={{ background: TYPES[t].hex }}
                    />
                    {t}.{TYPES[t].name}
                  </div>
                  <div
                    className="h-[14px] flex-1 overflow-hidden rounded-full"
                    style={{
                      background: C.paper2,
                      border: `1px solid ${C.line}`,
                    }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${w}%`, background: TYPES[t].hex }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 아래로 갈수록 배경색으로 사라지는 그라데이션 */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(251,247,238,0) 0%, rgba(251,247,238,.55) 45%, ${C.paper} 88%)`,
        }}
      />
      <div className="absolute inset-x-0 bottom-4 text-center">
        <span
          className="inline-flex items-center gap-[6px] rounded-full px-4 py-[9px] text-[13px] font-bold"
          style={{
            background: C.card,
            color: C.inkSoft,
            border: `1.5px solid ${C.line2}`,
            boxShadow: SHADOW,
          }}
        >
          🔒 검사결과는 상담 시 자세히 안내드려요
        </span>
      </div>
    </div>
  );
}

/* ---------- 검사 완료 페이지 (/enneagram/result/[id]) ---------- */
export function EnneagramResultPage({ name }: { name?: string }) {
  return (
    <div
      style={{ background: C.paper, color: C.ink, minHeight: '100dvh' }}
      className="[letter-spacing:-0.01em]"
    >
      <div className="mx-auto max-w-[760px] px-[18px] pb-[90px] pt-[22px]">
        <Brand />
        <div className="mb-4 text-center">
          <div className="mx-auto mb-3 flex justify-center">
            <Bloom size={90} filled={9} />
          </div>
          <h1 className="text-[24px] font-extrabold tracking-tight">
            수고하셨습니다!
          </h1>
          <p className="mt-2 text-[14px]" style={{ color: C.inkSoft }}>
            {name ? `${name} 학생의 ` : ''}검사가 정상적으로 제출되었어요.
          </p>
        </div>

        <BlurredResultPreview />

        <div
          className="rounded-2xl px-6 py-7 text-center"
          style={{
            background: C.sage,
            border: `1.5px solid ${C.green}`,
          }}
        >
          <p className="text-[15.5px] leading-[1.7]" style={{ color: C.ink }}>
            검사결과와 기질에 맞는 학습 코칭은
            <br />
            <b>{CONTACT.academy}</b>으로 문의주세요.
            <br />
            체험수업과 함께 상담드립니다.
          </p>
          <a
            href={`tel:${CONTACT.phone.replace(/-/g, '')}`}
            className="mt-3 block text-[26px] font-extrabold tracking-tight"
            style={{ color: C.green }}
          >
            {CONTACT.phone}
          </a>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-block rounded-full px-[26px] py-[14px] text-[15px] font-bold"
            style={{
              background: C.card,
              color: C.green,
              border: `1.5px solid ${C.line2}`,
            }}
          >
            다른 학생 검사하기
          </Link>
        </div>
      </div>
    </div>
  );
}
