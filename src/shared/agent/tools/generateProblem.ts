import 'server-only';
import { z } from 'zod';
import { claudeJson } from '@/shared/config/anthropic';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { searchChunks } from '@/entities/source/api/searchChunks';
import { buildProblemSystemPrompt } from '../prompts';
import type { AgentContext, Citation, ProblemDraft, ToolResult } from '../types';

export const generateProblemInput = z.object({
  topic: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  count: z.coerce.number().int().min(1).max(10).default(3),
  type: z.enum(['objective', 'short', 'long']).optional(),
  gradeHint: z.string().optional(),
});

export async function generateProblemTool(
  raw: unknown,
  ctx: AgentContext,
): Promise<ToolResult> {
  const args = generateProblemInput.parse(raw);

  const retrievalQuery = [args.topic, args.gradeHint, args.difficulty]
    .filter(Boolean)
    .join(' ') || '핵심 주제';
  const chunks = await searchChunks(retrievalQuery, {
    k: Math.min(12, Math.max(8, args.count * 2)),
    sourceIds: ctx.pinnedSourceIds,
    subject: ctx.subject,
  });

  if (chunks.length === 0) {
    return {
      kind: 'generate_problem',
      problems: [],
    };
  }

  // map source titles for citation labels
  const supabase = getSupabaseServer();
  const sourceIds = Array.from(new Set(chunks.map((c) => c.source_id)));
  const { data: srcRows } = await supabase
    .from('sources')
    .select('id, title')
    .in('id', sourceIds);
  const titleById = new Map((srcRows ?? []).map((r) => [r.id, r.title as string]));

  const refs = chunks.map((c, i) => ({
    index: i + 1,
    chunkId: c.id,
    sourceId: c.source_id,
    page: c.page_number,
    title: titleById.get(c.source_id) ?? '소스',
    content: c.content,
    chapterPath: c.chapter_path ?? [],
  }));

  const referencesBlock = refs
    .map((r) => {
      const chap = r.chapterPath.length ? ` [${r.chapterPath.join(' > ')}]` : '';
      return `[${r.index}] (${r.title}, p.${r.page ?? '?'}${chap}) ${r.content.slice(0, 800)}`;
    })
    .join('\n\n');

  const sys = buildProblemSystemPrompt({
    subject: ctx.subject,
    topic: args.topic,
    difficulty: args.difficulty,
    type: args.type,
    count: args.count,
    gradeHint: args.gradeHint,
  });

  const userPrompt = `REFERENCES:\n${referencesBlock}\n\n위 자료만 사용해서 ${args.count}개의 ${args.type ?? 'objective'} 문제를 만들어라.`;

  type RawProblem = {
    question: string;
    choices?: { label: string; text: string }[];
    answer: string;
    explanation: string;
    citation_indices: number[];
  };

  const parsed = await claudeJson<{ problems: RawProblem[] }>({
    system: sys,
    content: userPrompt,
    schema: {
      type: 'object',
      properties: {
        problems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              choices: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    text: { type: 'string' },
                  },
                  required: ['label', 'text'],
                  additionalProperties: false,
                },
              },
              answer: { type: 'string' },
              explanation: { type: 'string' },
              citation_indices: { type: 'array', items: { type: 'integer' } },
            },
            required: ['question', 'answer', 'explanation', 'citation_indices'],
            additionalProperties: false,
          },
        },
      },
      required: ['problems'],
      additionalProperties: false,
    },
    maxTokens: 8192,
  });

  const drafts: ProblemDraft[] = (parsed.problems ?? []).map((p) => {
    const citations: Citation[] = (p.citation_indices ?? [])
      .map((idx) => refs[idx - 1])
      .filter(Boolean)
      .map((r) => ({
        sourceId: r.sourceId,
        sourceTitle: r.title,
        page: r.page ?? null,
        snippet: r.content.slice(0, 160),
        chapterPath: r.chapterPath,
      }));
    return {
      topic: args.topic ?? null,
      difficulty: args.difficulty ?? 'medium',
      problem_type: args.type ?? 'objective',
      question: p.question,
      choices: p.choices ?? null,
      answer: p.answer,
      explanation: p.explanation ?? null,
      citations,
    };
  });

  // persist
  if (drafts.length > 0) {
    const rows = drafts.map((d) => ({
      subject: ctx.subject,
      subjects: [ctx.subject],
      topic: d.topic,
      difficulty: d.difficulty,
      problem_type: d.problem_type,
      question: d.question,
      choices: d.choices,
      answer: d.answer,
      explanation: d.explanation,
      citations: d.citations,
      created_by: 'agent',
      conversation_id: ctx.conversationId,
    }));
    const { data: ins, error } = await supabase
      .from('problems')
      .insert(rows)
      .select('id');
    if (!error && ins) {
      ins.forEach((row, i) => {
        drafts[i].id = row.id as string;
      });
    }
  }

  return { kind: 'generate_problem', problems: drafts };
}
