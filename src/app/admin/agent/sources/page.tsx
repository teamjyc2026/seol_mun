import { redirect } from 'next/navigation';
import { listSources } from '@/entities/source/server';
import { SourceLibraryPage } from '@/pages-fsd/source-library';
import { getUploaderId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getUploaderId())) {
    redirect('/admin/login?as=uploader');
  }
  const sources = await listSources();
  return <SourceLibraryPage initialSources={sources} />;
}
