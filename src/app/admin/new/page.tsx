import { redirect } from 'next/navigation';
import { AdminNewPage } from '@/pages-fsd/admin-new';
import { isAdmin } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await isAdmin())) {
    redirect('/admin/login');
  }
  return <AdminNewPage />;
}
