import { redirect } from 'next/navigation';

// PDF 워크벤치는 문제 전용이 아니라 통합 도구 — 독립 라우트로 이동했다.
export default function Page() {
  redirect('/admin/agent/workbench');
}
