import { redirect } from 'next/navigation';
import { listEnneagram } from '@/entities/enneagram/server';
import { isAdmin } from '@/shared/config/auth';
import { EnneagramAdmin } from '@/widgets/enneagram-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function EnneagramAdminPage() {
  if (!(await isAdmin())) {
    redirect('/admin/login');
  }
  const rows = await listEnneagram();
  return <EnneagramAdmin rows={rows} />;
}
