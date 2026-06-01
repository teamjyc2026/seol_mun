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
    topic: m.topic,
    difficulty: (m.difficulty ?? 'medium') as ProblemDraft['difficulty'],
    problem_type: (m.problem_type ?? 'objective') as ProblemDraft['problem_type'],
    question: m.question,
    choices: m.choices,
    answer: m.answer,
    explanation: m.explanation,
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
  const matches = await searchProblems(args.query, {
    k: args.k,
    subject: ctx.subject,
  });
  return { kind: 'search_problem', problems: toProblemDrafts(matches) };
}
