import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data: source } = await supabase
    .from('sources')
    .select('id, file_path')
    .eq('id', id)
    .maybeSingle();
  if (!source) {
    return NextResponse.json({ message: 'not found' }, { status: 404 });
  }

  // 소스 삭제 전: 이 소스의 워크벤치 작업으로 만든 문제들 언임베딩(문제는 보존).
  // 청크·작업·박스는 소스 cascade로 함께 삭제된다.
  const { data: srcJobs } = await supabase
    .from('workbench_jobs')
    .select('id')
    .eq('source_id', id);
  const jobIds = (srcJobs ?? []).map((j) => j.id as string);
  if (jobIds.length) {
    await supabase.rpc('unembed_workbench_jobs', { job_ids: jobIds });
  }

  await supabase.storage.from('sources').remove([source.file_path]).catch(() => undefined);
  const { error } = await supabase.from('sources').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
