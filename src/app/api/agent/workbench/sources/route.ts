import { NextResponse, type NextRequest } from 'next/server';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 워크벤치로 만든 소스만 — workbench_jobs.source_id에 존재하는 sources.
 * 시험범위 소스 피커가 "워크벤치로 만든 애들만" 보이도록 쓰는 게이트.
 */
export async function GET(req: NextRequest) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const subject = req.nextUrl.searchParams.get('subject');
  const supabase = getSupabaseServer();

  const { data: jobs } = await supabase.from('workbench_jobs').select('source_id');
  const sourceIds = Array.from(new Set((jobs ?? []).map((j) => j.source_id as string)));
  if (sourceIds.length === 0) return NextResponse.json({ sources: [] });

  let q = supabase
    .from('sources')
    .select('id, title, subject, grade, created_at')
    .in('id', sourceIds)
    .order('created_at', { ascending: false });
  if (subject) q = q.eq('subject', subject);
  const { data, error } = await q;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ sources: data ?? [] });
}
