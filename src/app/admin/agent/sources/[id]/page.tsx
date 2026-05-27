import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getSource } from '@/entities/source/api/listSources';
import { getSourceChunks } from '@/entities/source/api/getSourceChunks';
import { SourceDetailPage } from '@/pages-fsd/source-library';
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from '@/shared/config/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export default async function Page({ params }: Ctx) {
  const store = await cookies();
  if (store.get(ADMIN_COOKIE)?.value !== ADMIN_COOKIE_VALUE) {
    redirect('/admin/login');
  }
  const { id } = await params;
  const source = await getSource(id);
  if (!source) notFound();
  const chunks = await getSourceChunks(id);
  return <SourceDetailPage source={source} chunks={chunks} />;
}
