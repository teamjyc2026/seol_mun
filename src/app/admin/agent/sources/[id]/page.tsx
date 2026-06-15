import { notFound, redirect } from 'next/navigation';
import { getSource } from '@/entities/source/server';
import { getSourceChunks } from '@/entities/source/server';
import { SourceDetailPage } from '@/pages-fsd/source-library';
import { getUploaderId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export default async function Page({ params }: Ctx) {
  if (!(await getUploaderId())) {
    redirect('/admin/login?as=uploader');
  }
  const { id } = await params;
  const source = await getSource(id);
  if (!source) notFound();
  const chunks = await getSourceChunks(id);
  return <SourceDetailPage source={source} chunks={chunks} />;
}
