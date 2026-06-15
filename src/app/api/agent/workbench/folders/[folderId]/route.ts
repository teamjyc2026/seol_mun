import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ folderId: string }> };
const idSchema = z.string().uuid();

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  /** 폴더 이동 (null = 최상위). */
  parentId: z.string().uuid().nullable().optional(),
});

/** 폴더 이름 변경 / 이동. */
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

  // 폴더 이동: 자기 자신/하위로는 금지(사이클 방지).
  if (body.parentId !== undefined && body.parentId !== null) {
    if (body.parentId === folderId) {
      return NextResponse.json({ message: '폴더를 자기 자신으로 옮길 수 없어요.' }, { status: 400 });
    }
    const { data: all } = await supabase
      .from('workbench_folders')
      .select('id, parent_id');
    const parentOf = new Map((all ?? []).map((f) => [f.id as string, f.parent_id as string | null]));
    // 새 부모에서 위로 올라가다 folderId를 만나면 사이클.
    let cur: string | null = body.parentId;
    while (cur) {
      if (cur === folderId) {
        return NextResponse.json({ message: '하위 폴더로는 옮길 수 없어요.' }, { status: 400 });
      }
      cur = parentOf.get(cur) ?? null;
    }
  }

  const fields: Record<string, unknown> = {};
  if (body.name !== undefined) fields.name = body.name;
  if (body.parentId !== undefined) fields.parent_id = body.parentId;
  if (Object.keys(fields).length === 0) return NextResponse.json({ ok: true });

  const { error } = await supabase.from('workbench_folders').update(fields).eq('id', folderId);
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
