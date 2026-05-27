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

const createSchema = z.object({
  subject: z.string().min(1).max(50).default('국사'),
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
  const { data, error } = await supabase
    .from('problems')
    .insert({
      subject: body.subject,
      topic: body.topic ?? null,
      difficulty: body.difficulty ?? null,
      problem_type: body.problem_type ?? null,
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
