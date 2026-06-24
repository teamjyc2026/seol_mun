import { redirect } from 'next/navigation';
import { AccountsPage } from '@/pages-fsd/accounts';
import { listAccounts } from '@/entities/student/server';
import { getUploaderId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getUploaderId())) {
    redirect('/admin/login?as=uploader');
  }
  const data = await listAccounts();
  return <AccountsPage data={data} />;
}
