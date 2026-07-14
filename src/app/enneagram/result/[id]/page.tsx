import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EnneagramResultPage } from '@/pages-fsd/enneagram';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '에니어그램 기질 검사 완료',
  description:
    '검사가 제출되었습니다. 검사결과와 기질에 맞는 학습 코칭은 매쓰마인드 수학학원으로 문의주세요.',
  openGraph: {
    title: '에니어그램 기질 검사 완료',
    description:
      '검사가 제출되었습니다. 검사결과와 기질에 맞는 학습 코칭은 매쓰마인드 수학학원으로 문의주세요.',
    type: 'website',
  },
};

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
