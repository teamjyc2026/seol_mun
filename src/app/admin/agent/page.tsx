import { redirect } from 'next/navigation';
import { AgentPage } from '@/pages-fsd/agent';
import { listSources } from '@/entities/source/api/listSources';
import { getSessionUserId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getSessionUserId())) {
    redirect('/admin/login');
  }
  const sources = await listSources();
  return <AgentPage initialSources={sources} />;
}
