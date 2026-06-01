import { redirect } from 'next/navigation';
import { AdminNewPage } from '@/pages-fsd/admin-new';
import { getSessionUserId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getSessionUserId())) {
    redirect('/admin/login');
  }
  return <AdminNewPage />;
}
