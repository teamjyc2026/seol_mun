import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ProblemSetEditorPage } from '@/pages-fsd/problem-set-editor';
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from '@/shared/config/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  const store = await cookies();
  if (store.get(ADMIN_COOKIE)?.value !== ADMIN_COOKIE_VALUE) {
    redirect('/admin/login');
  }
  return <ProblemSetEditorPage />;
}
