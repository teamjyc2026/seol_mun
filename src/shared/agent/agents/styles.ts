import type { AgentId } from './types';

/**
 * Client-safe label + color maps for the specialist badge/prefix in the UI.
 * Kept separate from registry.ts (which is `server-only` and pulls in tools)
 * so client components can import these without bundling server code.
 */
export const AGENT_LABELS: Record<AgentId, string> = {
  socratic: '산파술',
  grammar: '문법',
  vocab: '어휘',
  problem_finder: '문제',
  companion: '잡담',
  emotion: '감정',
  general: '',
};

/** Tailwind text-color class per agent. `general` keeps the default zinc. */
export const AGENT_TEXT_CLASS: Record<AgentId, string> = {
  socratic: 'text-indigo-700',
  grammar: 'text-emerald-700',
  vocab: 'text-amber-700',
  problem_finder: 'text-blue-700',
  companion: 'text-pink-700',
  emotion: 'text-rose-700',
  general: '',
};
