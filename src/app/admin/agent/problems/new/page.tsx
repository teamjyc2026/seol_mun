import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { listSources } from '@/entities/source/api/listSources';
import { ProblemEditorPage } from '@/pages-fsd/problem-editor';
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from '@/shared/config/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  const store = await cookies();
  if (store.get(ADMIN_COOKIE)?.value !== ADMIN_COOKIE_VALUE) {
    redirect('/admin/login');
  }
  const sources = await listSources({ status: 'ready' });
  return <ProblemEditorPage sources={sources} />;
}
