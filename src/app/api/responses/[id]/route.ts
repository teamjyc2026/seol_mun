import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  answers: z.record(z.string(), z.any()).optional(),
  status: z.enum(['draft', 'submitted']).optional(),
});

const idSchema = z.string().uuid();

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('responses')
    .select('id, status, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ message: 'not found' }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  let parsed;
  try {
    parsed = patchSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: 'invalid body', details: String(e) },
      { status: 400 },
    );
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('responses')
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .single();
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
