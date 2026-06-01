import { redirect } from 'next/navigation';
import { AgentPage } from '@/pages-fsd/agent';
import { listSources } from '@/entities/source/api/listSources';
import { getUploaderId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getUploaderId())) {
    redirect('/admin/login?as=uploader');
  }
  const sources = await listSources();
  return <AgentPage initialSources={sources} />;
}
