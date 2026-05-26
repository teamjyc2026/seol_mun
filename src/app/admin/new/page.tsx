import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminNewPage } from '@/pages-fsd/admin-new';
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from '@/shared/config/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  if (cookieStore.get(ADMIN_COOKIE)?.value !== ADMIN_COOKIE_VALUE) {
    redirect('/admin/login');
  }
  return <AdminNewPage />;
}
