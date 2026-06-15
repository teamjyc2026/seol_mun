import { redirect } from 'next/navigation';
import { listProblems } from '@/entities/problem/server';
import { ProblemLibraryPage } from '@/pages-fsd/problem-library';
import { getUploaderId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getUploaderId())) {
    redirect('/admin/login?as=uploader');
  }
  const problems = await listProblems();
  return <ProblemLibraryPage initialProblems={problems} />;
}
