'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AREA,
  SCALE,
  SCALE_FULL,
  TYPES,
  QUESTIONS,
  TOTAL_QUESTIONS,
  PER_AREA,
  CONTACT,
  type EnneagramInfo,
  type EnneagramAnswers,
} from '@/entities/enneagram';
import { useSubmitEnneagram } from '@/features/submit-enneagram';
import { cn } from '@/shared/lib/cn';

/* ---------- palette (원본 CSS 변수 이식) ---------- */
const C = {
  paper: '#FBF7EE',
  paper2: '#F5EFE1',
  ink: '#2E3A2C',
  inkSoft: '#5B6656',
  line: '#E4DCC8',
  line2: '#D8CDB2',
  green: '#2F6B4F',
  greenD: '#245740',
  marigold: '#F2A93B',
  coral: '#E8734A',
  sage: '#EFF3E7',
  card: '#FFFDF7',
} as const;

const SHADOW =
  '0 1px 2px rgba(46,58,44,.06), 0 8px 24px rgba(46,58,44,.07)';

type Screen = 'home' | 'info' | 'quiz' | 'done';

const emptyInfo: EnneagramInfo = { name: '', school: '', grade: '', phone: '' };

function makeEmptyAnswers(): EnneagramAnswers {
  const a: EnneagramAnswers = {};
  for (let t = 1; t <= 9; t++) a[String(t)] = Array(PER_AREA).fill(0);
  return a;
}

/** 전화번호 입력 중 자동으로 하이픈을 채워준다 (010-1234-5678). */
function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/** 형식 검증: 10~11자리(하이픈 3-3-4 또는 3-4-4) 휴대폰 번호 */
function isValidPhone(v: string): boolean {
  return /^\d{2,3}-\d{3,4}-\d{4}$/.test(v.trim());
}

/* ---------- 9판 꽃 마크(SVG) ---------- */
function Bloom({ size = 96, filled = 9 }: { size?: number; filled?: number }) {
  const petals = [];
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * 360 - 90;
    const on = i < filled;
    const col = on ? TYPES[i + 1].hex : C.line;
    petals.push(
      <g key={i} transform={`rotate(${ang} 50 50)`}>
        <ellipse
          cx="50"
          cy="24"
          rx="8.5"
          ry="16"
          fill={col}
          opacity={on ? 1 : 0.55}
        />
      </g>,
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      style={{ display: 'block' }}
    >
      {petals}
      <circle cx="50" cy="50" r="11" fill={C.marigold} />
      <circle cx="50" cy="50" r="6" fill={C.coral} />
    </svg>
  );
}

/* ---------- 브랜드 헤더 ---------- */
function Brand({ withAdmin }: { withAdmin?: boolean }) {
  return (
    <div className="mb-7 flex items-center gap-3">
      <Bloom size={38} filled={9} />
      <div>
        <b className="block text-[16px] font-extrabold tracking-tight">
          학생 에니어그램 검사
        </b>
      </div>
      {withAdmin && (
        <Link
          href="/admin/login"
          className="ml-auto rounded-full border px-3 py-[7px] text-[12px] transition-colors"
          style={{
            color: C.inkSoft,
            borderColor: C.line2,
            background: C.card,
          }}
        >
          선생님 로그인
        </Link>
      )}
    </div>
  );
}

/* ================================================================= */

export function EnneagramApp() {
  const [screen, setScreen] = useState<Screen>('home');
  const [info, setInfo] = useState<EnneagramInfo>(emptyInfo);
  const [nameError, setNameError] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [area, setArea] = useState(1); // 현재 영역 1~9
  const [answers, setAnswers] = useState<EnneagramAnswers>(makeEmptyAnswers);
  const [missIdx, setMissIdx] = useState<number | null>(null);

  const qRefs = useRef<Array<HTMLDivElement | null>>([]);
  const navRef = useRef<HTMLDivElement | null>(null);

  const submit = useSubmitEnneagram({
    onSuccess: () => {
      go('done');
    },
  });

  const answeredCount = useMemo(() => {
    let c = 0;
    for (let t = 1; t <= 9; t++)
      c += (answers[String(t)] ?? []).filter((x) => x > 0).length;
    return c;
  }, [answers]);

  const go = (s: Screen) => {
    setScreen(s);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  const pick = (t: number, idx: number, v: number) => {
    setAnswers((prev) => {
      const next = { ...prev, [String(t)]: [...(prev[String(t)] ?? [])] };
      next[String(t)][idx] = v;
      return next;
    });
    if (missIdx === idx) setMissIdx(null);
    // 답하면 다음 문항으로 부드럽게 자동 스크롤 (마지막 문항이면 하단 버튼으로)
    requestAnimationFrame(() => {
      const nextEl = qRefs.current[idx + 1];
      (nextEl ?? navRef.current)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  const firstMissing = (t: number) =>
    (answers[String(t)] ?? []).findIndex((x) => x === 0);

  const submitInfo = () => {
    const name = info.name.trim();
    if (!name) {
      setNameError(true);
      return;
    }
    // 전화번호는 입력했을 때만 형식 검증(선택 입력)
    if (info.phone.trim() && !isValidPhone(info.phone)) {
      setPhoneError(true);
      return;
    }
    setInfo((i) => ({ ...i, name }));
    setArea(1);
    setNameError(false);
    setPhoneError(false);
    go('quiz');
  };

  const nextArea = () => {
    const miss = firstMissing(area);
    if (miss >= 0) {
      setMissIdx(miss);
      qRefs.current[miss]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }
    setMissIdx(null);
    if (area < 9) {
      setArea((a) => a + 1);
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    } else {
      // 마지막 영역 완료 → 제출
      submit.mutate({
        info: { ...info, name: info.name.trim() },
        answers,
      });
    }
  };

  const prevArea = () => {
    setMissIdx(null);
    if (area > 1) {
      setArea((a) => a - 1);
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    } else {
      go('info');
    }
  };

  const resetAll = () => {
    setInfo(emptyInfo);
    setAnswers(makeEmptyAnswers());
    setArea(1);
    setNameError(false);
    setMissIdx(null);
    go('home');
  };

  /* ---------- 공용 버튼 스타일 ---------- */
  const ctaStyle: React.CSSProperties = {
    background: C.green,
    color: '#fff',
    boxShadow: SHADOW,
  };
  const ghostStyle: React.CSSProperties = {
    background: C.card,
    color: C.green,
    border: `1.5px solid ${C.line2}`,
  };

  return (
    <div
      style={{ background: C.paper, color: C.ink, minHeight: '100dvh' }}
      className="[letter-spacing:-0.01em]"
    >
      <div className="mx-auto max-w-[760px] px-[18px] pb-[90px] pt-[22px]">
        {screen === 'home' && (
          <>
            <Brand withAdmin />
            <div className="px-[6px] pb-[6px] pt-[14px] text-center">
              <div className="mx-auto mb-5 flex justify-center">
                <Bloom size={110} filled={9} />
              </div>
              <h1 className="mb-4 text-[clamp(27px,6.5vw,40px)] font-extrabold leading-[1.2] tracking-[-0.03em]">
                자녀의 기질을 <span style={{ color: C.green }}>알아봅니다</span>
              </h1>
              <p
                className="mx-auto mb-2 max-w-[460px] text-[15px] leading-[1.6]"
                style={{ color: C.inkSoft }}
              >
                아이의 평소 모습을 떠올리며 생각 나는 대로 바로바로 질문에
                답해주세요. 9가지 기질 중 아이의 주요기질과 서브 기질을
                알려드립니다(약 10분~15분 소요)
              </p>
              <div className="mt-8">
                <button
                  onClick={() => go('info')}
                  className="inline-flex items-center gap-2 rounded-full px-[30px] py-[15px] text-[16px] font-bold transition-transform hover:-translate-y-px"
                  style={ctaStyle}
                >
                  검사 시작하기 &nbsp;→
                </button>
              </div>
            </div>
          </>
        )}

        {screen === 'info' && (
          <>
            <Brand />
            <div
              className="rounded-2xl p-[22px]"
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
                먼저 · 학생 정보
              </div>
              <h2 className="text-[20px] font-extrabold tracking-tight">
                누구의 검사인가요?
              </h2>
              <p
                className="mb-5 mt-2 text-[13.5px]"
                style={{ color: C.inkSoft }}
              >
                결과를 구분하기 위한 정보예요. 검사 자료로만 사용됩니다.
              </p>

              <Field
                label="이름"
                required
                value={info.name}
                error={nameError}
                onChange={(v) => {
                  setInfo((i) => ({ ...i, name: v }));
                  if (nameError && v.trim()) setNameError(false);
                }}
                placeholder="예: 김모디"
              />
              {nameError && (
                <p
                  className="-mt-3 mb-4 text-[12.5px] font-semibold"
                  style={{ color: C.coral }}
                >
                  이름을 입력해 주세요.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="학교"
                  value={info.school}
                  onChange={(v) => setInfo((i) => ({ ...i, school: v }))}
                  placeholder="예: 매쓰초"
                />
                <Field
                  label="학년"
                  value={info.grade}
                  onChange={(v) => setInfo((i) => ({ ...i, grade: v }))}
                  placeholder="예: 3학년"
                />
              </div>
              <Field
                label="전화번호"
                value={info.phone}
                error={phoneError}
                onChange={(v) => {
                  const formatted = formatPhone(v);
                  setInfo((i) => ({ ...i, phone: formatted }));
                  if (phoneError && (!formatted || isValidPhone(formatted)))
                    setPhoneError(false);
                }}
                placeholder="예: 010-1234-5678"
                inputMode="numeric"
              />
              {phoneError && (
                <p
                  className="-mt-3 mb-4 text-[12.5px] font-semibold"
                  style={{ color: C.coral }}
                >
                  전화번호 형식을 확인해 주세요. (예: 010-1234-5678)
                </p>
              )}

              <div className="mt-[10px] flex gap-3">
                <button
                  onClick={() => go('home')}
                  className="rounded-2xl px-[22px] py-[15px] text-[16px] font-bold"
                  style={ghostStyle}
                >
                  이전
                </button>
                <button
                  onClick={submitInfo}
                  className="flex-1 rounded-2xl py-[15px] text-[16px] font-bold"
                  style={ctaStyle}
                >
                  다음 &nbsp;→
                </button>
              </div>
            </div>
          </>
        )}

        {screen === 'quiz' &&
          (() => {
            const t = area;
            const qs = QUESTIONS[t];
            const pct = Math.round((answeredCount / TOTAL_QUESTIONS) * 100);
            const T = TYPES[t];
            return (
              <>
                {/* 진행바 */}
                <div
                  className="sticky top-0 z-20 -mx-[18px] mb-[18px] px-[18px] pb-[10px] pt-3 backdrop-blur"
                  style={{ background: 'rgba(251,247,238,.92)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-[9px] flex-1 overflow-hidden rounded-full"
                      style={{
                        background: C.paper2,
                        border: `1px solid ${C.line}`,
                      }}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${C.marigold}, ${C.green})`,
                        }}
                      />
                    </div>
                    <div
                      className="whitespace-nowrap text-[12.5px] font-bold"
                      style={{ color: C.inkSoft }}
                    >
                      {answeredCount}/{TOTAL_QUESTIONS}
                    </div>
                  </div>
                </div>

                {/* 영역 헤더 */}
                <div className="mb-5 mt-[6px] flex items-center gap-[14px]">
                  <div
                    className="grid h-11 w-11 flex-none place-items-center rounded-[13px] text-[19px] font-extrabold text-white"
                    style={{ background: T.hex, boxShadow: SHADOW }}
                  >
                    {AREA[t - 1]}
                  </div>
                  <div>
                    <h2 className="text-[20px] font-extrabold tracking-tight">
                      영역 {AREA[t - 1]}{' '}
                      <span
                        className="text-[14px] font-semibold"
                        style={{ color: C.inkSoft }}
                      >
                        전체 9개 중
                      </span>
                    </h2>
                    <div
                      className="mt-[2px] text-[12.5px] font-semibold"
                      style={{ color: C.inkSoft }}
                    >
                      아이의 평소 모습을 떠올리며 답해 주세요
                    </div>
                  </div>
                </div>

                <div
                  className="mb-1 rounded-[10px] px-3 py-[9px] text-center text-[11.5px]"
                  style={{
                    color: C.inkSoft,
                    background: C.paper2,
                    border: `1px solid ${C.line}`,
                  }}
                >
                  {SCALE_FULL}
                </div>

                {/* 문항 목록 */}
                <div className="mt-3 flex flex-col gap-[11px]">
                  {qs.map((q, idx) => {
                    const val = answers[String(t)]?.[idx] ?? 0;
                    const miss = missIdx === idx;
                    return (
                      <div
                        key={idx}
                        ref={(el) => {
                          qRefs.current[idx] = el;
                        }}
                        className="rounded-[15px] p-[15px]"
                        style={{
                          background: miss ? '#fdf3ee' : C.card,
                          border: `1px solid ${miss ? C.coral : C.line}`,
                        }}
                      >
                        <div className="mb-3 flex gap-[9px] text-[14.5px]">
                          <span
                            className="flex-none font-extrabold"
                            style={{ color: C.green }}
                          >
                            {idx + 1}
                          </span>
                          <span>{q}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-[6px]">
                          {[1, 2, 3, 4, 5].map((v) => {
                            const on = val === v;
                            return (
                              <button
                                key={v}
                                onClick={() => pick(t, idx, v)}
                                className={cn(
                                  'flex flex-col items-center gap-[3px] rounded-[10px] px-1 py-[9px]',
                                  'transition-[transform,background-color,border-color] duration-150 ease-out',
                                  'will-change-transform active:scale-90',
                                  on && 'scale-[1.07] shadow-md',
                                )}
                                style={{
                                  border: `1.5px solid ${on ? C.green : C.line2}`,
                                  background: on ? C.green : C.paper,
                                }}
                              >
                                <span
                                  className="text-[15px] font-extrabold"
                                  style={{ color: on ? '#fff' : C.inkSoft }}
                                >
                                  {v}
                                </span>
                                <span
                                  className="text-center text-[9.5px] leading-[1.15]"
                                  style={{ color: on ? '#fff' : C.inkSoft }}
                                >
                                  {SCALE[v - 1].split('\n').map((line, li) => (
                                    <span key={li} className="block">
                                      {line}
                                    </span>
                                  ))}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {submit.isError && (
                  <div
                    className="mt-4 rounded-[10px] px-3 py-[11px] text-[13px] font-semibold"
                    style={{ background: '#fdf3ee', color: C.coral }}
                  >
                    제출에 실패했어요. 다시 시도해 주세요.
                  </div>
                )}

                <div ref={navRef} className="mt-[22px] flex gap-3">
                  <button
                    onClick={prevArea}
                    className="rounded-2xl px-[22px] py-[15px] text-[16px] font-bold"
                    style={ghostStyle}
                    disabled={submit.isPending}
                  >
                    이전
                  </button>
                  <button
                    onClick={nextArea}
                    className="flex-1 rounded-2xl py-[15px] text-[16px] font-bold disabled:opacity-50"
                    style={ctaStyle}
                    disabled={submit.isPending}
                  >
                    {submit.isPending
                      ? '제출 중…'
                      : t < 9
                        ? '다음 영역 →'
                        : '제출하기 ✓'}
                  </button>
                </div>
                <div
                  className="mt-6 text-center text-[11.5px]"
                  style={{ color: C.inkSoft }}
                >
                  {t} / 9 영역
                  {t === 9 && ' · 제출하면 검사가 완료돼요 (수정 불가)'}
                </div>
              </>
            );
          })()}

        {screen === 'done' && (
          <DoneSheet name={info.name} onRestart={resetAll} />
        )}
      </div>
    </div>
  );
}

/* ---------- 입력 필드 ---------- */
function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
  inputMode,
  error,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  error?: boolean;
}) {
  return (
    <div className="mb-4">
      <label
        className="mb-[7px] block text-[13.5px] font-bold"
        style={{ color: C.ink }}
      >
        {label} {required && <span style={{ color: C.coral }}>*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        className="w-full rounded-xl px-[14px] py-[13px] text-[15px] outline-none"
        style={{
          color: C.ink,
          background: C.paper,
          border: `1.5px solid ${error ? C.coral : C.line2}`,
        }}
      />
    </div>
  );
}

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

/* ---------- 검사 완료 안내 (결과는 관리자 페이지에서만 열람) ---------- */
function DoneSheet({
  name,
  onRestart,
}: {
  name: string;
  onRestart: () => void;
}) {
  return (
    <>
      <Brand />
      <div className="mb-4 text-center">
        <div className="mx-auto mb-3 flex justify-center">
          <Bloom size={90} filled={9} />
        </div>
        <h1 className="text-[24px] font-extrabold tracking-tight">
          수고하셨습니다!
        </h1>
        <p
          className="mt-2 text-[14px]"
          style={{ color: C.inkSoft }}
        >
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
        <button
          onClick={onRestart}
          className="rounded-full px-[26px] py-[14px] text-[15px] font-bold"
          style={{
            background: C.card,
            color: C.green,
            border: `1.5px solid ${C.line2}`,
          }}
        >
          다른 학생 검사하기
        </button>
      </div>
    </>
  );
}
