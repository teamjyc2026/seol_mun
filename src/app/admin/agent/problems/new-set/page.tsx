import { redirect } from 'next/navigation';
import { ProblemSetEditorPage } from '@/pages-fsd/problem-set-editor';
import { getSessionUserId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getSessionUserId())) {
    redirect('/admin/login');
  }
  return <ProblemSetEditorPage />;
}
