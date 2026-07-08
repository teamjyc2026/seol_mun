/**
 * 설문②(학생 에니어그램) 관리자 집계 헬퍼.
 * 모두 순수 함수 — 현재 필터가 적용된 응답 배열을 받아 분포/평균을 계산한다.
 */

import { PER_AREA } from './questions';
import type { EnneagramResponseRow } from './types';

const TYPE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export type TypeDistItem = {
  /** 유형 (1~9) */
  type: number;
  count: number;
  /** 0~1 */
  percent: number;
};

/** top_type 또는 sub_type 기준 유형별 인원 분포 */
export function typeDistribution(
  rows: EnneagramResponseRow[],
  key: 'top_type' | 'sub_type',
): TypeDistItem[] {
  const total = rows.length;
  const counts = new Map<number, number>();
  for (const r of rows) {
    const t = r[key];
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return TYPE_IDS.map((type) => {
    const count = counts.get(type) ?? 0;
    return { type, count, percent: total ? count / total : 0 };
  });
}

/** 유형별 평균 점수(15~75). 응답이 없으면 0. */
export function averageScores(
  rows: EnneagramResponseRow[],
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const t of TYPE_IDS) {
    if (rows.length === 0) {
      out[t] = 0;
      continue;
    }
    let sum = 0;
    for (const r of rows) sum += r.scores?.[String(t)] ?? 0;
    out[t] = sum / rows.length;
  }
  return out;
}

export type QuestionAgg = {
  /** 1~15 */
  index: number;
  /** 유효 응답 수(0=미응답 제외) */
  count: number;
  /** 유효 응답 평균(1~5), 없으면 0 */
  avg: number;
  /** 값 1~5 각각의 카운트 [dist[0]=값1, .., dist[4]=값5] */
  dist: [number, number, number, number, number];
};

/** 한 영역(type 1~9)의 문항별(15) 응답 집계 */
export function areaQuestionAgg(
  rows: EnneagramResponseRow[],
  type: number,
): QuestionAgg[] {
  const key = String(type);
  const out: QuestionAgg[] = [];
  for (let i = 0; i < PER_AREA; i++) {
    const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    let sum = 0;
    let count = 0;
    for (const r of rows) {
      const v = r.answers?.[key]?.[i] ?? 0;
      if (v >= 1 && v <= 5) {
        dist[v - 1] += 1;
        sum += v;
        count += 1;
      }
    }
    out.push({ index: i + 1, count, avg: count ? sum / count : 0, dist });
  }
  return out;
}
