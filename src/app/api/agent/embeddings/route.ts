import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { embedQuery } from '@/shared/lib/embedding';
import { buildProblemEmbedText } from '@/shared/agent/buildProblemEmbedText';
import { buildEmbeddingText, type EmbedMeta } from '@/shared/agent/buildEmbeddingText';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * 저장과 분리된 임베딩 일괄 처리. "임베딩이 비어 있음(=null) = 대기" 한 가지
 * 상태로 통일 — 신규·수정 모두 대기로 모이고, 차원을 바꿔 전체가 null이 돼도
 * 같은 경로로 재임베딩된다.
 *  - GET  → 대기 개수 { problems, chunks }
 *  - POST → 대기분 일괄 임베딩(한 번에 limit개씩) → 처리/잔여 개수
 */
export async function GET() {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseServer();
  const [{ count: problems }, { count: chunks }] = await Promise.all([
    supabase.from('problems').select('id', { count: 'exact', head: true }).is('embedding', null),
    supabase
      .from('source_chunks')
      .select('id', { count: 'exact', head: true })
      .is('embedding', null),
  ]);
  return NextResponse.json({ problems: problems ?? 0, chunks: chunks ?? 0 });
}

/** 일괄 언임베딩 — 임베딩된 문제·청크 전부 비운다(embedding/embedded_at = null). 행은 보존. */
export async function DELETE() {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseServer();
  // 비울 개수 먼저 집계(응답용).
  const [{ count: problems }, { count: chunks }] = await Promise.all([
    supabase
      .from('problems')
      .select('id', { count: 'exact', head: true })
      .not('embedding', 'is', null),
    supabase
      .from('source_chunks')
      .select('id', { count: 'exact', head: true })
      .not('embedding', 'is', null),
  ]);
  const [{ error: pErr }, { error: cErr }] = await Promise.all([
    supabase
      .from('problems')
      .update({ embedding: null, embedded_at: null })
      .not('embedding', 'is', null),
    supabase.from('source_chunks').update({ embedding: null }).not('embedding', 'is', null),
  ]);
  if (pErr || cErr) {
    return NextResponse.json({ message: pErr?.message ?? cErr?.message ?? 'failed' }, { status: 500 });
  }
  return NextResponse.json({ problemsUnembedded: problems ?? 0, chunksUnembedded: chunks ?? 0 });
}

const runSchema = z.object({ limit: z.number().int().min(1).max(100).default(30) });

async function pendingCounts(supabase: ReturnType<typeof getSupabaseServer>) {
  const [{ count: problems }, { count: chunks }] = await Promise.all([
    supabase.from('problems').select('id', { count: 'exact', head: true }).is('embedding', null),
    supabase
      .from('source_chunks')
      .select('id', { count: 'exact', head: true })
      .is('embedding', null),
  ]);
  return { problems: problems ?? 0, chunks: chunks ?? 0 };
}

export async function POST(req: NextRequest) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = runSchema.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ message: 'invalid body' }, { status: 400 });
  }
  const supabase = getSupabaseServer();

  let problemsEmbedded = 0;
  let chunksEmbedded = 0;

  // ── 문제 ──
  const { data: probs } = await supabase
    .from('problems')
    .select('id, subject, topic, difficulty, problem_type, question, choices, answer, explanation')
    .is('embedding', null)
    .order('created_at', { ascending: true })
    .limit(body.limit);
  for (const p of probs ?? []) {
    try {
      const vector = await embedQuery(buildProblemEmbedText(p));
      const { error } = await supabase
        .from('problems')
        .update({ embedding: vector as unknown as string, embedded_at: new Date().toISOString() })
        .eq('id', p.id);
      if (!error) problemsEmbedded += 1;
    } catch {
      // 한 건 실패해도 나머지는 계속 — 다음 호출에서 재시도된다.
    }
  }

  // ── 청크(개념/본문) — 소스 메타를 한 번에 모아 임베딩 텍스트 재구성 ──
  const { data: chunks } = await supabase
    .from('source_chunks')
    .select('id, source_id, page_number, chapter_path, content')
    .is('embedding', null)
    .order('created_at', { ascending: true })
    .limit(body.limit);
  const srcIds = [...new Set((chunks ?? []).map((c) => c.source_id))];
  const metaById = new Map<string, EmbedMeta>();
  if (srcIds.length) {
    const { data: srcs } = await supabase
      .from('sources')
      .select('id, title, subject, grade, publisher, edition, author, source_type, units, tags')
      .in('id', srcIds);
    for (const s of srcs ?? []) {
      metaById.set(s.id, {
        subject: s.subject,
        grade: s.grade,
        publisher: s.publisher,
        edition: s.edition,
        author: s.author,
        source_type: s.source_type,
        bookKeywords: s.units,
        tags: s.tags,
        title: s.title,
      });
    }
  }
  for (const c of chunks ?? []) {
    const meta = metaById.get(c.source_id);
    if (!meta) continue;
    try {
      const vector = await embedQuery(
        buildEmbeddingText({ ...meta, page: c.page_number, chapterPath: c.chapter_path }, c.content),
      );
      const { error } = await supabase
        .from('source_chunks')
        .update({ embedding: vector as unknown as string })
        .eq('id', c.id);
      if (!error) chunksEmbedded += 1;
    } catch {
      // skip & retry next call
    }
  }

  const remaining = await pendingCounts(supabase);
  return NextResponse.json({
    problemsEmbedded,
    chunksEmbedded,
    problemsRemaining: remaining.problems,
    chunksRemaining: remaining.chunks,
  });
}
