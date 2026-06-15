import { NextResponse } from 'next/server';
import { getStudentId, requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 전체 시험범위 목록 — 학생/교사 채팅의 범위 셀렉터용.
 * (학생도 호출하므로 uploader 또는 로그인 학생 모두 허용.)
 */
export async function GET() {
  const isUploader = await requireUploader();
  const studentId = isUploader ? null : await getStudentId();
  if (!isUploader && !studentId) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseServer();
  const { data: scopes, error } = await supabase
    .from('exam_scopes')
    .select('id, name, subject, grade, school_id, created_at')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const schoolIds = Array.from(new Set((scopes ?? []).map((s) => s.school_id as string)));
  const scopeIds = (scopes ?? []).map((s) => s.id as string);
  const [{ data: schools }, { data: srcRows }] = await Promise.all([
    schoolIds.length
      ? supabase.from('schools').select('id, name').in('id', schoolIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    scopeIds.length
      ? supabase.from('exam_scope_sources').select('scope_id').in('scope_id', scopeIds)
      : Promise.resolve({ data: [] as { scope_id: string }[] }),
  ]);
  const schoolName = new Map((schools ?? []).map((s) => [s.id as string, s.name as string]));
  const counts = new Map<string, number>();
  for (const r of srcRows ?? [])
    counts.set(r.scope_id as string, (counts.get(r.scope_id as string) ?? 0) + 1);

  return NextResponse.json({
    scopes: (scopes ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      subject: s.subject,
      grade: s.grade,
      schoolId: s.school_id,
      schoolName: schoolName.get(s.school_id as string) ?? null,
      sourceCount: counts.get(s.id as string) ?? 0,
    })),
  });
}
