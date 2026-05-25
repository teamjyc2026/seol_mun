import { Suspense } from 'react';
import { SurveyPage } from '@/pages-fsd/survey';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-zinc-50" />}>
      <SurveyPage />
    </Suspense>
  );
}
