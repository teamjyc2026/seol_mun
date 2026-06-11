import { redirect } from 'next/navigation';
import { listSchools } from '@/entities/school/api/listSchools';
import { PdfWorkbenchPage } from '@/pages-fsd/pdf-workbench';
import { getUploaderId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getUploaderId())) {
    redirect('/admin/login?as=uploader');
  }
  const schools = await listSchools();
  return <PdfWorkbenchPage schools={schools} />;
}
