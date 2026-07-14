import type { Metadata } from 'next';
import { EnneagramApp } from '@/pages-fsd/enneagram';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '에니어그램 기질 검사',
  description:
    '자녀의 기질을 알아보는 학생 에니어그램 검사입니다. 9가지 기질 중 주요기질과 서브기질을 알려드립니다.',
  openGraph: {
    title: '에니어그램 기질 검사',
    description:
      '자녀의 기질을 알아보는 학생 에니어그램 검사입니다. 9가지 기질 중 주요기질과 서브기질을 알려드립니다.',
    type: 'website',
  },
};

export default function Page() {
  return <EnneagramApp />;
}
