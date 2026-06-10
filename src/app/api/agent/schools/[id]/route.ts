import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  grade: z.string().max(20).nullable().optional(),
  /** Full replacement of this school's source assignment. */
  sourceIds: z.array(z.string().uuid()).optional(),
});

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
    return NextResponse.json({ message: 'invalid body', details: String(e) }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const fields: Record<string, unknown> = {};
  if (body.name !== undefined) fields.name = body.name.trim();
  if (body.description !== undefined) fields.description = body.description;
  if (body.grade !== undefined) fields.grade = body.grade;
  if (Object.keys(fields).length > 0) {
    const { error } = await supabase.from('schools').update(fields).eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (body.sourceIds) {
    // Full replacement: unassign everything currently on this school, then
    // assign the requested set.
    const { error: clearErr } = await supabase
      .from('sources')
      .update({ school_id: null })
      .eq('school_id', id);
    if (clearErr) return NextResponse.json({ message: clearErr.message }, { status: 500 });
    if (body.sourceIds.length > 0) {
      const { error: setErr } = await supabase
        .from('sources')
        .update({ school_id: id })
        .in('id', body.sourceIds);
      if (setErr) return NextResponse.json({ message: setErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
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
  // sources.school_id has ON DELETE SET NULL — assignments are released.
  const { error } = await supabase.from('schools').delete().eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
