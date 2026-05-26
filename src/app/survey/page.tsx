import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { SurveyPage } from '@/pages-fsd/survey';
import { isClosed } from '@/shared/config/cap';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (await isClosed()) redirect('/closed');
  return (
    <Suspense fallback={<div className="min-h-svh bg-zinc-50" />}>
      <SurveyPage />
    </Suspense>
  );
}
