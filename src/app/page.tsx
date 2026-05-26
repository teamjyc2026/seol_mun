import { redirect } from 'next/navigation';
import { LandingPage } from '@/pages-fsd/landing';
import { isClosed } from '@/shared/config/cap';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (await isClosed()) redirect('/closed');
  return <LandingPage />;
}
