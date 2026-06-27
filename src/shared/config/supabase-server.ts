import { createClient } from '@supabase/supabase-js';

/**
 * 프로젝트 URL은 공개값(브라우저 번들에도 노출됨)이라 코드에 기본값을 박아둔다.
 * 이러면 배포 env에서 NEXT_PUBLIC_SUPABASE_URL이 빠져도 앱이 500/빈DB로 죽지 않고
 * 올바른 프로젝트로 붙는다. env가 설정돼 있으면 그 값이 우선(다른 프로젝트로 옮길 때).
 * ⚠️ 키(anon/service)는 비밀이라 절대 코드에 박지 않는다 — env로만.
 */
const DEFAULT_SUPABASE_URL = 'https://iipdlqssbekbssejopcf.supabase.co';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseServer() {
  const key = serviceKey || anonKey;
  if (!key) throw new Error('Supabase server key is not set (anon/service env 누락)');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
