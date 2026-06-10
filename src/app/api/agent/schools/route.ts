import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** List schools with their assigned (ready) source counts. */
export async function GET() {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseServer();
  const { data: schools, error } = await supabase
    .from('schools')
    .select('id, name, description, grade, created_at')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const { data: srcRows } = await supabase
    .from('sources')
    .select('id, school_id, indexing_status')
    .not('school_id', 'is', null);
  const counts = new Map<string, { total: number; ready: number }>();
  for (const r of srcRows ?? []) {
    const c = counts.get(r.school_id as string) ?? { total: 0, ready: 0 };
    c.total += 1;
    if (r.indexing_status === 'ready') c.ready += 1;
    counts.set(r.school_id as string, c);
  }

  return NextResponse.json({
    schools: (schools ?? []).map((s) => ({
      ...s,
      sourceCount: counts.get(s.id as string)?.total ?? 0,
      readySourceCount: counts.get(s.id as string)?.ready ?? 0,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  grade: z.string().max(20).optional(),
});

export async function POST(req: NextRequest) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = createSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ message: 'invalid body', details: String(e) }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('schools')
    .insert({
      name: body.name.trim(),
      description: body.description ?? null,
      grade: body.grade ?? null,
    })
    .select('id, name, description, grade, created_at')
    .single();
  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ message: error.message }, { status });
  }
  return NextResponse.json({ school: data }, { status: 201 });
}
