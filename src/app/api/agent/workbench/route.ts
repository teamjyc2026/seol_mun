import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 워크벤치 작업(게시글) 목록 — 누구든 열어 이어서 작업할 수 있다. */
export async function GET() {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseServer();
  const { data: jobs, error } = await supabase
    .from('workbench_jobs')
    .select('id, source_id, title, folder_id, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const jobIds = (jobs ?? []).map((j) => j.id);
  const sourceIds = (jobs ?? []).map((j) => j.source_id);
  const [{ data: boxRows }, { data: srcRows }, { data: attRows }] = await Promise.all([
    jobIds.length
      ? supabase.from('workbench_boxes').select('job_id, status').in('job_id', jobIds)
      : Promise.resolve({ data: [] as { job_id: string; status: string }[] }),
    sourceIds.length
      ? supabase.from('sources').select('id, subject, grade, total_pages').in('id', sourceIds)
      : Promise.resolve({ data: [] as { id: string; subject: string; grade: string | null }[] }),
    jobIds.length
      ? supabase.from('workbench_attachments').select('job_id').in('job_id', jobIds)
      : Promise.resolve({ data: [] as { job_id: string }[] }),
  ]);
  const counts = new Map<string, { total: number; saved: number }>();
  for (const b of boxRows ?? []) {
    const c = counts.get(b.job_id) ?? { total: 0, saved: 0 };
    c.total += 1;
    if (b.status === 'saved') c.saved += 1;
    counts.set(b.job_id, c);
  }
  const attCounts = new Map<string, number>();
  for (const a of attRows ?? []) {
    attCounts.set(a.job_id, (attCounts.get(a.job_id) ?? 0) + 1);
  }
  const srcById = new Map((srcRows ?? []).map((s) => [s.id, s]));

  return NextResponse.json({
    jobs: (jobs ?? []).map((j) => ({
      ...j,
      attachmentCount: attCounts.get(j.id) ?? 0,
      subject: srcById.get(j.source_id)?.subject ?? null,
      grade: srcById.get(j.source_id)?.grade ?? null,
      boxCount: counts.get(j.id)?.total ?? 0,
      savedCount: counts.get(j.id)?.saved ?? 0,
    })),
  });
}

const createSchema = z.object({
  sourceId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  /** 부속 PDF(답안지·해설 등) — upload-url로 업로드해 둔 경로들. */
  attachments: z
    .array(
      z.object({
        path: z.string().regex(/^[0-9a-f-]{36}\.pdf$/i),
        title: z.string().trim().min(1).max(100),
      }),
    )
    .max(10)
    .default([]),
});

/** 새 작업 생성 (소스 등록 직후 호출). */
export async function POST(req: NextRequest) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: 'invalid body' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('workbench_jobs')
    .insert({ source_id: body.sourceId, title: body.title })
    .select('id')
    .single();
  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'insert failed' }, { status: 500 });
  }
  if (body.attachments.length) {
    const { error: attError } = await supabase.from('workbench_attachments').insert(
      body.attachments.map((a) => ({
        job_id: data.id,
        title: a.title,
        file_path: a.path,
      })),
    );
    if (attError) {
      return NextResponse.json({ message: attError.message }, { status: 500 });
    }
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
