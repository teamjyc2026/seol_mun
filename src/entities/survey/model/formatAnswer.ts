import { questions } from './questions';
import type { Question } from './types';

function optionLabel(q: Question, value: string): string {
  const o = q.options?.find((x) => x.value === value);
  return o?.label ?? value;
}

/** Render an answer value as a human-readable string for the dashboard. */
export function formatAnswer(questionId: string, value: unknown): string {
  const q = questions[questionId as keyof typeof questions];
  if (!q) return value == null ? '—' : JSON.stringify(value);
  if (value === null || value === undefined || value === '') return '—';

  switch (q.type) {
    case 'single':
      return optionLabel(q, String(value));
    case 'multi':
      if (!Array.isArray(value)) return '—';
      return value.length
        ? (value as string[]).map((v) => optionLabel(q, v)).join(', ')
        : '—';
    case 'scale':
      return `${value} / ${q.scale?.max ?? 5}`;
    case 'short':
    case 'long':
      return String(value);
    case 'rank': {
      if (typeof value !== 'object' || Array.isArray(value)) return '—';
      const map = value as Record<string, string>;
      return Object.keys(map)
        .sort((a, b) => Number(a) - Number(b))
        .map((rank) => `${rank}순위: ${optionLabel(q, map[rank])}`)
        .join(' · ');
    }
    default:
      return JSON.stringify(value);
  }
}
