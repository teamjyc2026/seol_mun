import { NextResponse } from 'next/server';
import { getStudentId } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 로그인한 학생 본인의 대화 목록. */
export async function GET() {
  const studentId = await getStudentId();
  if (!studentId) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('agent_conversations')
    .select('id, title, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}
