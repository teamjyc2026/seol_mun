import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ folderId: string }> };
const idSchema = z.string().uuid();

const patchSchema = z.object({ name: z.string().trim().min(1).max(60) });

/** 폴더 이름 변경. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { folderId } = await ctx.params;
  if (!idSchema.safeParse(folderId).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  let body;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: 'invalid body' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('workbench_folders')
    .update({ name: body.name })
    .eq('id', folderId);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** 폴더 삭제 — 소속 작업은 미분류로(on delete set null). */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { folderId } = await ctx.params;
  if (!idSchema.safeParse(folderId).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('workbench_folders').delete().eq('id', folderId);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
