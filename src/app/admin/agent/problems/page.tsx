import { redirect } from 'next/navigation';
import { listProblems } from '@/entities/problem/api/listProblems';
import { ProblemLibraryPage } from '@/pages-fsd/problem-library';
import { getSessionUserId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getSessionUserId())) {
    redirect('/admin/login');
  }
  const problems = await listProblems();
  return <ProblemLibraryPage initialProblems={problems} />;
}
