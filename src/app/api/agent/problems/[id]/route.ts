import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  DIFFICULTIES,
  PROBLEM_TYPES,
} from '@/entities/problem/model/types';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

const choiceSchema = z.object({
  label: z.string().min(1).max(8),
  text: z.string().min(1).max(500),
});
const citationSchema = z.object({
  sourceId: z.string().uuid(),
  sourceTitle: z.string().optional(),
  page: z.coerce.number().int().min(1).nullable().optional(),
  snippet: z.string().max(500).default(''),
});
const figureSchema = z.object({
  url: z.string().url().max(1000),
  caption: z.string().max(500).optional(),
  explanation: z.string().max(4000).optional(),
});

const patchSchema = z
  .object({
    subject: z.string().min(1).max(50),
    topic: z.string().max(100).nullable(),
    difficulty: z.enum(DIFFICULTIES).nullable(),
    problem_type: z.enum(PROBLEM_TYPES).nullable(),
    passage: z.string().max(20000).nullable(),
    passage_translation: z.string().max(20000).nullable(),
    question: z.string().min(1).max(4000),
    choices: z.array(choiceSchema).max(10).nullable(),
    answer: z.string().min(1).max(2000),
    explanation: z.string().max(4000).nullable(),
    core_content: z.string().max(4000).nullable(),
    choice_explanation: z.string().max(8000).nullable(),
    figures: z.array(figureSchema).max(10),
    notes: z.string().max(2000).nullable(),
    citations: z.array(citationSchema).max(20),
  })
  .partial();

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('problems')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'not found' }, { status: 404 });
  return NextResponse.json({ problem: data });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  let body;
  try {
    body = patchSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: '입력이 올바르지 않습니다.', details: String(e) },
      { status: 400 },
    );
  }
  const supabase = getSupabaseServer();
  // Keep the subjects[] array in sync when the primary subject changes.
  const update: Record<string, unknown> = body.subject
    ? { ...body, subjects: [body.subject] }
    : { ...body };
  // Editing content makes any stored embedding stale → drop it so the agent
  // never returns outdated text. (Re-embed with ⚡ to make it searchable again.)
  const CONTENT_KEYS = [
    'subject',
    'topic',
    'difficulty',
    'problem_type',
    'passage',
    'passage_translation',
    'question',
    'choices',
    'answer',
    'explanation',
  ] as const;
  if (CONTENT_KEYS.some((k) => k in body)) {
    update.embedding = null;
    update.embedded_at = null;
  }
  const { data, error } = await supabase
    .from('problems')
    .update(update)
    .eq('id', id)
    .select('id')
    .single();
  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'failed' }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('problems').delete().eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
