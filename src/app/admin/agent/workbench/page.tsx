import { redirect } from 'next/navigation';
import { PdfWorkbenchPage } from '@/pages-fsd/pdf-workbench';
import { getUploaderId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getUploaderId())) {
    redirect('/admin/login?as=uploader');
  }
  return <PdfWorkbenchPage />;
}
