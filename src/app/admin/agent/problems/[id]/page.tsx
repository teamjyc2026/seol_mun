import { notFound, redirect } from 'next/navigation';
import { getProblem } from '@/entities/problem/api/listProblems';
import { listSources } from '@/entities/source/api/listSources';
import { ProblemEditorPage } from '@/pages-fsd/problem-editor';
import { getSessionUserId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export default async function Page({ params }: Ctx) {
  if (!(await getSessionUserId())) {
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
