import { redirect } from 'next/navigation';
import { listResponses } from '@/entities/response/api/listResponses';
import { AdminDashboard } from '@/widgets/admin-dashboard';
import { getSessionUserId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!(await getSessionUserId())) {
    redirect('/admin/login');
  }
  const responses = await listResponses();
  return <AdminDashboard responses={responses} />;
}
