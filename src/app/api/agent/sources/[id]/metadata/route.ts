import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { GRADES, SOURCE_TYPES } from '@/entities/source/model/types';
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from '@/shared/config/admin';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE;
}

const patchSchema = z
  .object({
    title: z.string().min(1).max(200),
    source_type: z.enum(SOURCE_TYPES),
    subject: z.string().min(1).max(50),
    grade: z.enum(GRADES).nullable(),
    publisher: z.string().max(100).nullable(),
    year: z.coerce.number().int().min(1900).max(2100).nullable(),
    description: z.string().max(2000).nullable(),
    author: z.string().max(100).nullable(),
    edition: z.string().max(100).nullable(),
    isbn: z.string().max(40).nullable(),
    units: z.array(z.string().min(1).max(80)).max(40),
    tags: z.array(z.string().min(1).max(40)).max(40),
  })
  .partial();

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) {
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
  const { data, error } = await supabase
    .from('sources')
    .update(body)
    .eq('id', id)
    .select('id')
    .single();
  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'failed' }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
