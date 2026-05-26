import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { listResponses } from '@/entities/response/api/listResponses';
import { AdminDashboard } from '@/widgets/admin-dashboard';
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from '@/shared/config/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const cookieStore = await cookies();
  if (cookieStore.get(ADMIN_COOKIE)?.value !== ADMIN_COOKIE_VALUE) {
    redirect('/admin/login');
  }
  const responses = await listResponses();
  return <AdminDashboard responses={responses} />;
}
