import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { embedQuery } from '@/shared/lib/embedding';
import { stripRichText } from '@/shared/lib/richText';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

/**
 * Build the text we embed for a problem. We include topic + question +
 * choices labels + answer + explanation so semantic search like "임진왜란
 * 객관식 문제 비슷한 거" hits across all of them.
 */
function buildProblemEmbedText(p: {
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
  problem_type: string | null;
  question: string;
  choices: { label: string; text: string }[] | null;
  answer: string;
  explanation: string | null;
}): string {
  const parts: string[] = [];
  const meta: string[] = [];
  if (p.subject) meta.push(`과목:${p.subject}`);
  if (p.topic) meta.push(`단원:${p.topic}`);
  if (p.difficulty) meta.push(`난이도:${p.difficulty}`);
  if (p.problem_type) meta.push(`유형:${p.problem_type}`);
  if (meta.length) parts.push(`[${meta.join(' / ')}]`);
  parts.push(stripRichText(p.question));
  if (p.choices?.length) {
    parts.push(p.choices.map((c) => `${c.label}. ${stripRichText(c.text)}`).join('\n'));
  }
  parts.push(`정답: ${stripRichText(p.answer)}`);
  if (p.explanation) parts.push(`해설: ${stripRichText(p.explanation)}`);
  return parts.join('\n\n');
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { data: problem, error } = await supabase
    .from('problems')
    .select('id, subject, topic, difficulty, problem_type, question, choices, answer, explanation')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!problem) return NextResponse.json({ message: 'not found' }, { status: 404 });

  try {
    const text = buildProblemEmbedText(problem);
    const vector = await embedQuery(text);
    const { error: updErr } = await supabase
      .from('problems')
      .update({
        embedding: vector as unknown as string,
        embedded_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (updErr) {
      return NextResponse.json({ message: updErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : '임베딩 실패' },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: 'invalid id' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('problems')
    .update({ embedding: null, embedded_at: null })
    .eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
