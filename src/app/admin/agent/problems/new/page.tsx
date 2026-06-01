import { redirect } from 'next/navigation';
import { listSources } from '@/entities/source/api/listSources';
import { ProblemEditorPage } from '@/pages-fsd/problem-editor';
import { getSessionUserId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getSessionUserId())) {
    redirect('/admin/login');
  }
  const sources = await listSources({ status: 'ready' });
  return <ProblemEditorPage sources={sources} />;
}
