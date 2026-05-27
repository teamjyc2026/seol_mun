import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from '@/shared/config/admin';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE;
}

/**
 * Distinct chapter labels collected from:
 *   - source_chunks.chapter_path   (auto-derived per chunk)
 *   - sources.units                (admin-typed book keywords)
 *
 * For chapter_path we include both the full breadcrumb ("A > B > C") and
 * each individual segment ("A", "B", "C") so the autocomplete catches
 * either flavor.
 */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseServer();
  const { data: chunks, error: cErr } = await supabase
    .from('source_chunks')
    .select('chapter_path')
    .not('chapter_path', 'is', null);
  if (cErr) return NextResponse.json({ message: cErr.message }, { status: 500 });

  const { data: sources, error: sErr } = await supabase
    .from('sources')
    .select('units')
    .not('units', 'is', null);
  if (sErr) return NextResponse.json({ message: sErr.message }, { status: 500 });

  const set = new Set<string>();
  for (const row of chunks ?? []) {
    const path = (row.chapter_path ?? []) as string[];
    if (path.length === 0) continue;
    set.add(path.join(' > '));
    for (const seg of path) {
      const s = seg.trim();
      if (s) set.add(s);
    }
  }
  for (const row of sources ?? []) {
    for (const u of (row.units ?? []) as string[]) {
      const s = u.trim();
      if (s) set.add(s);
    }
  }
  const chapters = Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  return NextResponse.json({ chapters });
}
