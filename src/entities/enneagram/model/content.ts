import { TYPES } from './questions';

/**
 * 결과지(자동생성)에 들어갈 유형별 출력 내용.
 *
 * ▸ summary : 결과지 상단 한 줄 요약 (기본값은 유형 짧은 설명)
 * ▸ body    : 유형별 상세 설명. 여러 문단 가능(줄바꿈 \n\n 으로 문단 구분).
 *             👉 원장님이 가지고 계신 "유형별 출력내용" 파일 내용을 여기에 붙여넣으면
 *                결과지에 그대로 자동 반영됩니다. 비워두면 요약만 표시됩니다.
 *
 * 예)  1: { summary: '...', body: `첫 문단...\n\n둘째 문단...` },
 */
export type TypeSheet = {
  summary: string;
  body: string;
};

export const SHEETS: Record<number, TypeSheet> = {
  1: { summary: TYPES[1].desc, body: '' },
  2: { summary: TYPES[2].desc, body: '' },
  3: { summary: TYPES[3].desc, body: '' },
  4: { summary: TYPES[4].desc, body: '' },
  5: { summary: TYPES[5].desc, body: '' },
  6: { summary: TYPES[6].desc, body: '' },
  7: { summary: TYPES[7].desc, body: '' },
  8: { summary: TYPES[8].desc, body: '' },
  9: { summary: TYPES[9].desc, body: '' },
};

/** 결과 상담 및 문의 (결과지·홈 하단 노출) */
export const CONTACT = {
  label: '검사결과 상담 및 문의',
  academy: '매쓰마인드 수학학원',
  phone: '010-3533-5877',
};
