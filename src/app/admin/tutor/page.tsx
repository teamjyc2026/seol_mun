import { redirect } from 'next/navigation';
import { listResponses } from '@/entities/response/server';
import { AdminDashboard } from '@/widgets/admin-dashboard';
import { isAdmin } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AdminTutorPage() {
  if (!(await isAdmin())) {
    redirect('/admin/login');
  }
  const responses = await listResponses();
  return <AdminDashboard responses={responses} />;
}
