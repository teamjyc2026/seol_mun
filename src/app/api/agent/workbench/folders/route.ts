import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 워크벤치 폴더 목록 + 각 폴더의 작업 수. */
export async function GET() {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseServer();
  const { data: folders, error } = await supabase
    .from('workbench_folders')
    .select('id, name, created_at')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const { data: jobRows } = await supabase
    .from('workbench_jobs')
    .select('folder_id')
    .not('folder_id', 'is', null);
  const counts = new Map<string, number>();
  for (const j of jobRows ?? [])
    counts.set(j.folder_id as string, (counts.get(j.folder_id as string) ?? 0) + 1);

  return NextResponse.json({
    folders: (folders ?? []).map((f) => ({
      ...f,
      jobCount: counts.get(f.id as string) ?? 0,
    })),
  });
}

const createSchema = z.object({ name: z.string().trim().min(1).max(60) });

/** 폴더 생성. */
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
    .from('workbench_folders')
    .insert({ name: body.name })
    .select('id, name, created_at')
    .single();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ folder: { ...data, jobCount: 0 } }, { status: 201 });
}
