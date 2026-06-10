import { redirect } from 'next/navigation';
import { AgentPage } from '@/pages-fsd/agent';
import { listSources } from '@/entities/source/api/listSources';
import { listSchools } from '@/entities/school/api/listSchools';
import { getUploaderId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getUploaderId())) {
    redirect('/admin/login?as=uploader');
  }
  const [sources, schools] = await Promise.all([listSources(), listSchools()]);
  return <AgentPage initialSources={sources} initialSchools={schools} />;
}
