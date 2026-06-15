import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();

/** 한 학교의 시험범위 목록 + 각 범위의 소스 개수. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { data: scopes, error } = await supabase
    .from('exam_scopes')
    .select('id, name, subject, grade, created_at')
    .eq('school_id', id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const scopeIds = (scopes ?? []).map((s) => s.id as string);
  const counts = new Map<string, number>();
  if (scopeIds.length) {
    const { data: rows } = await supabase
      .from('exam_scope_sources')
      .select('scope_id')
      .in('scope_id', scopeIds);
    for (const r of rows ?? [])
      counts.set(r.scope_id as string, (counts.get(r.scope_id as string) ?? 0) + 1);
  }

  return NextResponse.json({
    scopes: (scopes ?? []).map((s) => ({ ...s, sourceCount: counts.get(s.id as string) ?? 0 })),
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  subject: z.string().max(50).optional(),
  grade: z.string().max(20).optional(),
});

/** 시험범위 생성. */
export async function POST(req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  let body;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: 'invalid body' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('exam_scopes')
    .insert({
      school_id: id,
      name: body.name,
      subject: body.subject ?? null,
      grade: body.grade ?? null,
    })
    .select('id, name, subject, grade, created_at')
    .single();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ scope: { ...data, sourceCount: 0 } }, { status: 201 });
}
