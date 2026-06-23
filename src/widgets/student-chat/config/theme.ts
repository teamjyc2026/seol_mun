import type { Subject } from '@/shared/config/subjects';

export const MASCOT = '🦊';
export const MASCOT_NAME = '모디';

export const SUBJECT_EMOJI: Record<Subject, string> = {
  국사: '🏯',
  국어: '📖',
  영어: '🔤',
  수학: '➗',
  사회: '🌏',
  과학: '🔬',
  한국지리: '🗺️',
  세계사: '🌍',
  도덕: '💛',
  기타: '✨',
};

/** 퀵리플라이·과목 필 버튼에 로테이션으로 입히는 듀오링고풍 팔레트. */
export const PILL_PALETTE = [
  'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 active:border-b-2 active:translate-y-[2px]',
  'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:border-b-2 active:translate-y-[2px]',
  'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 active:border-b-2 active:translate-y-[2px]',
  'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 active:border-b-2 active:translate-y-[2px]',
] as const;
