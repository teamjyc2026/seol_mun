import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseServer() {
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  const key = serviceKey || anonKey;
  if (!key) throw new Error('Supabase server key is not set');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
