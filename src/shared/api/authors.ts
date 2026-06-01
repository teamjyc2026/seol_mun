import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve uuid-form `created_by` values (the column is free text — it also
 * holds legacy 'admin' / 'agent' markers) to admin/uploader nicknames in one
 * batched query.
 */
export async function nicknamesByIds(
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const uuids = [
    ...new Set(ids.filter((v): v is string => !!v && UUID_RE.test(v))),
  ];
  if (uuids.length === 0) return new Map();
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('admin_users')
    .select('id, nickname')
    .in('id', uuids);
  return new Map((data ?? []).map((u) => [u.id as string, u.nickname as string]));
}
