import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { listProblems } from '@/entities/problem/api/listProblems';
import { ProblemLibraryPage } from '@/pages-fsd/problem-library';
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from '@/shared/config/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  const store = await cookies();
  if (store.get(ADMIN_COOKIE)?.value !== ADMIN_COOKIE_VALUE) {
    redirect('/admin/login');
  }
  const problems = await listProblems();
  return <ProblemLibraryPage initialProblems={problems} />;
}
