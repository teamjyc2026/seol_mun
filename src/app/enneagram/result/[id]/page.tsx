import { notFound } from 'next/navigation';
import { EnneagramResultPage } from '@/pages-fsd/enneagram';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  // 이름만 조회한다 — 결과(top/sub/scores)는 관리자 전용이므로 절대 내려주지 않는다.
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('enneagram_responses')
    .select('name')
    .eq('id', id)
    .maybeSingle();

  if (!data) notFound();

  return <EnneagramResultPage name={data.name ?? undefined} />;
}
