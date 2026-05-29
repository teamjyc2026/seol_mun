export const SUBJECTS = [
  '국사',
  '국어',
  '영어',
  '수학',
  '사회',
  '과학',
  '한국지리',
  '세계사',
  '도덕',
  '기타',
] as const;

export type Subject = (typeof SUBJECTS)[number];

export const DEFAULT_SUBJECT: Subject = '국사';

export function isSubject(v: unknown): v is Subject {
  return typeof v === 'string' && (SUBJECTS as readonly string[]).includes(v);
}
