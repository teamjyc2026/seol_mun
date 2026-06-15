import { redirect } from 'next/navigation';
import { getUploaderId } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { listSchools } from '@/entities/school/server';
import { SchoolRagPage, type SchoolSourceRow } from '@/pages-fsd/school-rag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getUploaderId())) {
    redirect('/admin/login?as=uploader');
  }
  const supabase = getSupabaseServer();
  const [schools, { data: sources }] = await Promise.all([
    listSchools(),
    supabase
      .from('sources')
      .select('id, title, subject, grade, source_type, indexing_status, school_id')
      .order('created_at', { ascending: false }),
  ]);
  return (
    <SchoolRagPage
      initialSchools={schools}
      initialSources={(sources ?? []) as SchoolSourceRow[]}
    />
  );
}
