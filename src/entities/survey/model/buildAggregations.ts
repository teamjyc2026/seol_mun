import { questionList } from './questions';
import type { Question, QuestionId, SurveyAnswers } from './types';

export type AggCount = {
  value: string;
  label: string;
  count: number;
  /** ratio of respondents (single sums to ~1; multi can exceed 1) */
  percent: number;
};

export type QuestionAggregation =
  | {
      kind: 'single';
      type: 'single';
      total: number;
      counts: AggCount[];
    }
  | {
      kind: 'multi';
      type: 'multi';
      total: number;
      counts: AggCount[];
    }
  | {
      kind: 'scale';
      type: 'scale';
      total: number;
      avg: number;
      min: number;
      max: number;
      /** dist[i] = count for score (min + i) */
      dist: number[];
    }
  | {
      kind: 'rank';
      type: 'rank';
      total: number;
      rows: {
        value: string;
        label: string;
        avgRank: number;
        count: number;
      }[];
    }
  | {
      kind: 'text';
      type: 'short' | 'long';
      total: number;
      samples: string[];
    };

function optionLabel(q: Question, value: string): string {
  return q.options?.find((o) => o.value === value)?.label ?? value;
}

function aggregateSingle(q: Question, values: unknown[]): QuestionAggregation {
  const taken = values.filter((v) => typeof v === 'string' && v.length > 0) as string[];
  const map = new Map<string, number>();
  for (const v of taken) map.set(v, (map.get(v) ?? 0) + 1);
  const total = taken.length;
  const baseOptions = q.options ?? [];
  const seenValues = new Set(baseOptions.map((o) => o.value));
  const counts: AggCount[] = baseOptions.map((o) => ({
    value: o.value,
    label: o.label,
    count: map.get(o.value) ?? 0,
    percent: total ? (map.get(o.value) ?? 0) / total : 0,
  }));
  // capture any non-listed values that crept in
  for (const [v, c] of map) {
    if (!seenValues.has(v)) {
      counts.push({ value: v, label: v, count: c, percent: total ? c / total : 0 });
    }
  }
  return { kind: 'single', type: 'single', total, counts };
}

function aggregateMulti(q: Question, values: unknown[]): QuestionAggregation {
  const taken = values.filter((v) => Array.isArray(v)) as string[][];
  const map = new Map<string, number>();
  for (const arr of taken) for (const v of arr) map.set(v, (map.get(v) ?? 0) + 1);
  const total = taken.length;
  const baseOptions = q.options ?? [];
  const seenValues = new Set(baseOptions.map((o) => o.value));
  const counts: AggCount[] = baseOptions.map((o) => ({
    value: o.value,
    label: o.label,
    count: map.get(o.value) ?? 0,
    percent: total ? (map.get(o.value) ?? 0) / total : 0,
  }));
  for (const [v, c] of map) {
    if (!seenValues.has(v)) {
      counts.push({ value: v, label: v, count: c, percent: total ? c / total : 0 });
    }
  }
  return { kind: 'multi', type: 'multi', total, counts };
}

function aggregateScale(q: Question, values: unknown[]): QuestionAggregation {
  const min = q.scale?.min ?? 1;
  const max = q.scale?.max ?? 5;
  const len = max - min + 1;
  const dist = Array.from({ length: len }, () => 0);
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (typeof v !== 'number' || Number.isNaN(v)) continue;
    if (v < min || v > max) continue;
    dist[v - min] += 1;
    sum += v;
    n += 1;
  }
  return {
    kind: 'scale',
    type: 'scale',
    total: n,
    avg: n ? sum / n : 0,
    min,
    max,
    dist,
  };
}

function aggregateRank(q: Question, values: unknown[]): QuestionAggregation {
  const acc = new Map<string, { sum: number; count: number }>();
  let total = 0;
  for (const v of values) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const map = v as Record<string, string>;
    let touched = false;
    for (const [rank, optValue] of Object.entries(map)) {
      const r = Number(rank);
      if (!Number.isFinite(r)) continue;
      const cur = acc.get(optValue) ?? { sum: 0, count: 0 };
      cur.sum += r;
      cur.count += 1;
      acc.set(optValue, cur);
      touched = true;
    }
    if (touched) total += 1;
  }
  const rows = (q.options ?? [])
    .map((o) => {
      const a = acc.get(o.value);
      return {
        value: o.value,
        label: o.label,
        count: a?.count ?? 0,
        avgRank: a && a.count ? a.sum / a.count : Number.POSITIVE_INFINITY,
      };
    })
    .sort((a, b) => a.avgRank - b.avgRank);
  return { kind: 'rank', type: 'rank', total, rows };
}

function aggregateText(q: Question, values: unknown[]): QuestionAggregation {
  const samples: string[] = [];
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    samples.push(trimmed);
    if (samples.length >= 100) break;
  }
  return {
    kind: 'text',
    type: q.type === 'long' ? 'long' : 'short',
    total: samples.length,
    samples,
  };
}

export function buildAggregations(
  responses: { answers: SurveyAnswers }[],
): Record<QuestionId, QuestionAggregation> {
  const out: Record<string, QuestionAggregation> = {};
  for (const q of questionList) {
    const values = responses.map((r) => r.answers?.[q.id]);
    switch (q.type) {
      case 'single':
        out[q.id] = aggregateSingle(q, values);
        break;
      case 'multi':
        out[q.id] = aggregateMulti(q, values);
        break;
      case 'scale':
        out[q.id] = aggregateScale(q, values);
        break;
      case 'rank':
        out[q.id] = aggregateRank(q, values);
        break;
      case 'short':
      case 'long':
        out[q.id] = aggregateText(q, values);
        break;
    }
  }
  return out as Record<QuestionId, QuestionAggregation>;
}
