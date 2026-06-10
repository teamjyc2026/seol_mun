import { redirect } from 'next/navigation';
import { getUploaderId } from '@/shared/config/auth';
import { listSchools } from '@/entities/school/api/listSchools';
import { ManualSourcePage } from '@/pages-fsd/manual-source';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getUploaderId())) {
    redirect('/admin/login?as=uploader');
  }
  const schools = await listSchools();
  return <ManualSourcePage schools={schools} />;
}
