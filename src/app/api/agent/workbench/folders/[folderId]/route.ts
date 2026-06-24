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

/**
 * 폴더 삭제 — 폴더(+하위 폴더)와 그 안 작업·교재(소스)·청크까지 통째로 삭제.
 * 거기서 만든 문제는 언임베딩(보존). 소스 삭제가 작업·박스·청크를 cascade로 정리.
 */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { folderId } = await ctx.params;
  if (!idSchema.safeParse(folderId).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();

  // 1) 폴더 + 모든 하위 폴더 수집.
  const { data: allFolders } = await supabase
    .from('workbench_folders')
    .select('id, parent_id');
  const childrenOf = new Map<string, string[]>();
  for (const f of allFolders ?? []) {
    const p = f.parent_id as string | null;
    if (p) childrenOf.set(p, [...(childrenOf.get(p) ?? []), f.id as string]);
  }
  const folderIds: string[] = [];
  const stack = [folderId];
  while (stack.length) {
    const cur = stack.pop() as string;
    folderIds.push(cur);
    stack.push(...(childrenOf.get(cur) ?? []));
  }

  // 2) 그 폴더들의 작업 → job/source id.
  const { data: jobs } = await supabase
    .from('workbench_jobs')
    .select('id, source_id')
    .in('folder_id', folderIds);
  const jobIds = (jobs ?? []).map((j) => j.id as string);
  const sourceIds = [...new Set((jobs ?? []).map((j) => j.source_id as string).filter(Boolean))];

  // 3) 박스(savedRefs)가 cascade로 지워지기 전에 문제 언임베딩(보존).
  if (jobIds.length) {
    await supabase.rpc('unembed_workbench_jobs', { job_ids: jobIds });
  }

  // 4) 소스 삭제(→ 작업·박스·청크 cascade). 스토리지 PDF도 정리.
  if (sourceIds.length) {
    const { data: srcs } = await supabase
      .from('sources')
      .select('file_path')
      .in('id', sourceIds);
    const paths = (srcs ?? []).map((s) => s.file_path as string).filter(Boolean);
    if (paths.length) await supabase.storage.from('sources').remove(paths).catch(() => undefined);
    await supabase.from('sources').delete().in('id', sourceIds);
  }

  // 5) 폴더(들) 삭제.
  const { error } = await supabase.from('workbench_folders').delete().in('id', folderIds);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
