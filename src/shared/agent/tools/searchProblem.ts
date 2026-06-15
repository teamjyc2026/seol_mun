import 'server-only';
import { z } from 'zod';
import {
  searchProblems,
  type ProblemMatch,
} from '@/entities/problem/api/searchProblems';
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
  });
  // Specialist peek (grammar/vocab/socratic): only surface relevant matches,
  // and at most `limit`, so an off-topic saved problem never tags along.
  const result = peek
    ? matches.filter((m) => m.similarity >= peek.minSimilarity).slice(0, peek.limit)
    : matches;
  return { kind: 'search_problem', problems: toProblemDrafts(result) };
}
