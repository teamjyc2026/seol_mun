import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ scopeId: string }> };
const idSchema = z.string().uuid();

/** 시험범위 상세 — 메타 + 포함된 소스 id들. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { scopeId } = await ctx.params;
  if (!idSchema.safeParse(scopeId).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { data: scope } = await supabase
    .from('exam_scopes')
    .select('id, school_id, name, subject, grade, created_at')
    .eq('id', scopeId)
    .maybeSingle();
  if (!scope) return NextResponse.json({ message: 'not found' }, { status: 404 });
  const [{ data: rows }, { data: probRows }] = await Promise.all([
    supabase.from('exam_scope_sources').select('source_id').eq('scope_id', scopeId),
    supabase.from('exam_scope_problems').select('problem_id').eq('scope_id', scopeId),
  ]);
  return NextResponse.json({
    scope,
    sourceIds: (rows ?? []).map((r) => r.source_id as string),
    problemIds: (probRows ?? []).map((r) => r.problem_id as string),
  });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  subject: z.string().max(50).nullable().optional(),
  grade: z.string().max(20).nullable().optional(),
  /** 범위에 포함할 소스 전체 교체 (본문/개념 청크 대상). */
  sourceIds: z.array(z.string().uuid()).optional(),
  /** 범위에 포함할 문제 전체 교체 (문제 단위 선택). */
  problemIds: z.array(z.string().uuid()).optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { scopeId } = await ctx.params;
  if (!idSchema.safeParse(scopeId).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  let body;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: 'invalid body' }, { status: 400 });
  }
  const supabase = getSupabaseServer();

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) fields.name = body.name;
  if (body.subject !== undefined) fields.subject = body.subject;
  if (body.grade !== undefined) fields.grade = body.grade;
  const { error: upErr } = await supabase.from('exam_scopes').update(fields).eq('id', scopeId);
  if (upErr) return NextResponse.json({ message: upErr.message }, { status: 500 });

  if (body.sourceIds) {
    // 워크벤치로 만든 소스만 허용 — workbench_jobs에 있는 source_id로 필터.
    const { data: jobs } = await supabase.from('workbench_jobs').select('source_id');
    const allowed = new Set((jobs ?? []).map((j) => j.source_id as string));
    const ids = body.sourceIds.filter((s) => allowed.has(s));

    const { error: delErr } = await supabase
      .from('exam_scope_sources')
      .delete()
      .eq('scope_id', scopeId);
    if (delErr) return NextResponse.json({ message: delErr.message }, { status: 500 });
    if (ids.length > 0) {
      const { error: insErr } = await supabase
        .from('exam_scope_sources')
        .insert(ids.map((source_id) => ({ scope_id: scopeId, source_id })));
      if (insErr) return NextResponse.json({ message: insErr.message }, { status: 500 });
    }
  }

  if (body.problemIds) {
    // 실제 존재하는 문제만 — 잘못된 id 하나로 전체 insert가 실패하지 않게 거른다.
    let valid = body.problemIds;
    if (valid.length) {
      const { data: existing } = await supabase
        .from('problems')
        .select('id')
        .in('id', valid);
      valid = (existing ?? []).map((r) => r.id as string);
    }
    const { error: delErr } = await supabase
      .from('exam_scope_problems')
      .delete()
      .eq('scope_id', scopeId);
    if (delErr) return NextResponse.json({ message: delErr.message }, { status: 500 });
    if (valid.length > 0) {
      const { error: insErr } = await supabase
        .from('exam_scope_problems')
        .insert(valid.map((problem_id) => ({ scope_id: scopeId, problem_id })));
      if (insErr) return NextResponse.json({ message: insErr.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { scopeId } = await ctx.params;
  if (!idSchema.safeParse(scopeId).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('exam_scopes').delete().eq('id', scopeId);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
