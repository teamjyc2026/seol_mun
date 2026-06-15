import { stripRichText } from '@/shared/lib/richText';

/**
 * 문제 임베딩 텍스트 — 단원·발문·보기·정답·해설을 모아 "임진왜란 객관식 비슷한
 * 거" 같은 의미 검색이 두루 걸리게 한다. 개별/일괄 임베딩이 공유한다.
 */
export function buildProblemEmbedText(p: {
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
  problem_type: string | null;
  question: string;
  choices: { label: string; text: string }[] | null;
  answer: string;
  explanation: string | null;
}): string {
  const parts: string[] = [];
  const meta: string[] = [];
  if (p.subject) meta.push(`과목:${p.subject}`);
  if (p.topic) meta.push(`단원:${p.topic}`);
  if (p.difficulty) meta.push(`난이도:${p.difficulty}`);
  if (p.problem_type) meta.push(`유형:${p.problem_type}`);
  if (meta.length) parts.push(`[${meta.join(' / ')}]`);
  parts.push(stripRichText(p.question));
  if (p.choices?.length) {
    parts.push(p.choices.map((c) => `${c.label}. ${stripRichText(c.text)}`).join('\n'));
  }
  parts.push(`정답: ${stripRichText(p.answer)}`);
  if (p.explanation) parts.push(`해설: ${stripRichText(p.explanation)}`);
  return parts.join('\n\n');
}
