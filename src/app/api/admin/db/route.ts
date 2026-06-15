import { NextResponse, type NextRequest } from 'next/server';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 원본 행을 들여다볼 수 있는 테이블 화이트리스트 (콘텐츠·구조만, 인증/PII 제외). */
export const DB_TABLES = [
  'problems',
  'sources',
  'source_chunks',
  'workbench_jobs',
  'workbench_boxes',
  'workbench_attachments',
  'exam_scopes',
  'exam_scope_sources',
  'exam_scope_problems',
  'schools',
] as const;
type DbTable = (typeof DB_TABLES)[number];

/** 원본 DB 뷰어 — 화이트리스트 테이블의 행을 읽기전용으로 조회. */
export async function GET(req: NextRequest) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const table = url.searchParams.get('table') as DbTable | null;
  if (!table || !DB_TABLES.includes(table)) {
    return NextResponse.json({ message: 'invalid table', tables: DB_TABLES }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  const supabase = getSupabaseServer();
  // created_at 내림차순 우선, 없는 테이블이면 정렬 없이 재시도.
  const run = (order: boolean) => {
    let q = supabase.from(table).select('*', { count: 'exact' });
    if (order) q = q.order('created_at', { ascending: false });
    return q.range(offset, offset + limit - 1);
  };
  let { data, error, count } = await run(true);
  if (error) ({ data, error, count } = await run(false));
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ table, rows: data ?? [], count: count ?? 0, limit, offset });
}
