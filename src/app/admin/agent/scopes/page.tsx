import { redirect } from 'next/navigation';
import { ExamScopePage } from '@/pages-fsd/exam-scope';
import { getUploaderId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getUploaderId())) {
    redirect('/admin/login?as=uploader');
  }
  return <ExamScopePage />;
}
