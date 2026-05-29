import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  DIFFICULTIES,
  PROBLEM_TYPES,
} from '@/entities/problem/model/types';
import {
  listProblems,
  type ListProblemsFilters,
} from '@/entities/problem/api/listProblems';
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from '@/shared/config/admin';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE;
}

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

const subProblemSchema = z.object({
  topic: z.string().max(100).nullable().optional(),
  difficulty: z.enum(DIFFICULTIES).nullable().optional(),
  problem_type: z.enum(PROBLEM_TYPES).nullable().optional(),
  question: z.string().min(1).max(4000),
  choices: z.array(choiceSchema).max(10).nullable().optional(),
  answer: z.string().min(1).max(2000),
  explanation: z.string().max(4000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  citations: z.array(citationSchema).max(20).default([]),
});

const createSchema = z.object({
  subject: z.string().min(1).max(50).default('국사'),
  subjects: z.array(z.string().min(1).max(50)).max(20).optional(),
  passage: z.string().max(20000).nullable().optional(),
  topic: z.string().max(100).nullable().optional(),
  difficulty: z.enum(DIFFICULTIES).nullable().optional(),
  problem_type: z.enum(PROBLEM_TYPES).nullable().optional(),
  question: z.string().min(1).max(4000),
  choices: z.array(choiceSchema).max(10).nullable().optional(),
  answer: z.string().min(1).max(2000),
  explanation: z.string().max(4000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  citations: z.array(citationSchema).max(20).default([]),
});

/** Bulk: one passage shared across N sub-problems. */
const createSetSchema = z.object({
  subject: z.string().min(1).max(50).default('국사'),
  subjects: z.array(z.string().min(1).max(50)).max(20).optional(),
  passage: z.string().min(1).max(20000),
  shared: z
    .object({
      topic: z.string().max(100).nullable().optional(),
      difficulty: z.enum(DIFFICULTIES).nullable().optional(),
      problem_type: z.enum(PROBLEM_TYPES).nullable().optional(),
      citations: z.array(citationSchema).max(20).default([]),
    })
    .optional(),
  problems: z.array(subProblemSchema).min(1).max(20),
});

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const filters: ListProblemsFilters = {
    search: url.searchParams.get('search') ?? undefined,
    topic: url.searchParams.get('topic') ?? undefined,
    difficulty:
      (url.searchParams.get('difficulty') as ListProblemsFilters['difficulty']) ??
      undefined,
    problem_type:
      (url.searchParams.get('problem_type') as ListProblemsFilters['problem_type']) ??
      undefined,
    sourceId: url.searchParams.get('sourceId') ?? undefined,
  };
  try {
    const problems = await listProblems(filters);
    return NextResponse.json({ problems });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : 'error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = createSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: '입력이 올바르지 않습니다.', details: String(e) },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  const subjects = body.subjects && body.subjects.length ? body.subjects : [body.subject];
  const { data, error } = await supabase
    .from('problems')
    .insert({
      subject: body.subject,
      subjects,
      topic: body.topic ?? null,
      difficulty: body.difficulty ?? null,
      problem_type: body.problem_type ?? null,
      passage: body.passage ?? null,
      question: body.question,
      choices: body.choices ?? null,
      answer: body.answer,
      explanation: body.explanation ?? null,
      notes: body.notes ?? null,
      citations: body.citations ?? [],
      created_by: 'admin',
    })
    .select('id')
    .single();
  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'failed' }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}

/** PUT /api/agent/problems  with body={passage, problems:[...]} creates a set. */
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = createSetSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: '입력이 올바르지 않습니다.', details: String(e) },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  const subjects =
    body.subjects && body.subjects.length ? body.subjects : [body.subject];
  const passageSetId = crypto.randomUUID();
  const shared: NonNullable<typeof body.shared> = body.shared ?? {
    topic: null,
    difficulty: null,
    problem_type: null,
    citations: [],
  };
  const rows = body.problems.map((p) => ({
    subject: body.subject,
    subjects,
    passage: body.passage,
    passage_set_id: passageSetId,
    topic: p.topic ?? shared.topic ?? null,
    difficulty: p.difficulty ?? shared.difficulty ?? null,
    problem_type: p.problem_type ?? shared.problem_type ?? null,
    question: p.question,
    choices: p.choices ?? null,
    answer: p.answer,
    explanation: p.explanation ?? null,
    notes: p.notes ?? null,
    citations: p.citations.length ? p.citations : (shared.citations ?? []),
    created_by: 'admin',
  }));
  const { data, error } = await supabase
    .from('problems')
    .insert(rows)
    .select('id');
  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'failed' }, { status: 500 });
  }
  return NextResponse.json(
    { passageSetId, ids: data.map((r) => r.id) },
    { status: 201 },
  );
}
