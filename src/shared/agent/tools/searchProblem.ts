import 'server-only';
import { z } from 'zod';
import {
  searchProblems,
  type ProblemMatch,
} from '@/entities/problem/server';
import type { AgentContext, ProblemDraft, ToolResult } from '../types';

export const searchProblemInput = z.object({
  query: z.string().min(1),
  k: z.number().int().min(1).max(10).optional(),
});

/** Map vector-search rows to the chat ProblemDraft shape used by ProblemCard. */
export function toProblemDrafts(matches: ProblemMatch[]): ProblemDraft[] {
  return matches.map((m) => ({
    id: m.id,
    passage: m.passage,
    passage_set_id: m.passage_set_id,
    topic: m.topic,
    difficulty: (m.difficulty ?? 'medium') as ProblemDraft['difficulty'],
    problem_type: (m.problem_type ?? 'objective') as ProblemDraft['problem_type'],
    question: m.question,
    choices: m.choices,
    answer: m.answer,
    explanation: m.explanation,
    figures: m.figures ?? [],
    citations: (m.citations ?? []).map((c) => ({
      sourceId: c.sourceId,
      sourceTitle: c.sourceTitle,
      page: c.page,
      snippet: c.snippet,
    })),
  }));
}

export async function searchProblemTool(
  raw: unknown,
  ctx: AgentContext,
): Promise<ToolResult> {
  const args = searchProblemInput.parse(raw);
  const peek = ctx.problemPeek;
  const matches = await searchProblems(args.query, {
    k: peek?.limit ?? args.k,
    subject: ctx.subject,
    problemIds: ctx.problemIds,
  });
  // 한 턴에 문제는 1개만 — 여러 카드가 한꺼번에 쏟아지지 않게 항상 캡.
  // (peek 프로필은 minSimilarity로 무관한 매치도 거른다.)
  const filtered = peek ? matches.filter((m) => m.similarity >= peek.minSimilarity) : matches;
  const result = filtered.slice(0, peek?.limit ?? 1);
  return { kind: 'search_problem', problems: toProblemDrafts(result) };
}
