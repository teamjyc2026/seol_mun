import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getProblem } from '@/entities/problem/api/listProblems';
import { listSources } from '@/entities/source/api/listSources';
import { ProblemEditorPage } from '@/pages-fsd/problem-editor';
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
  const [problem, sources] = await Promise.all([
    getProblem(id),
    listSources({ status: 'ready' }),
  ]);
  if (!problem) notFound();
  return <ProblemEditorPage sources={sources} initialProblem={problem} />;
}
