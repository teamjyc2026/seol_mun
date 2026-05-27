import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AgentPage } from '@/pages-fsd/agent';
import { listSources } from '@/entities/source/api/listSources';
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from '@/shared/config/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  const store = await cookies();
  if (store.get(ADMIN_COOKIE)?.value !== ADMIN_COOKIE_VALUE) {
    redirect('/admin/login');
  }
  const sources = await listSources();
  return <AgentPage initialSources={sources} />;
}
