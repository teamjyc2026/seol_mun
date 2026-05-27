import 'server-only';
import { z } from 'zod';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import type { AgentContext, LevelResult, ToolResult } from '../types';

const WEIGHT: Record<string, number> = { easy: 1, medium: 1.5, hard: 2 };

export const assessLevelInput = z.object({
  studentId: z.string().min(1).optional(),
  scope: z.enum(['subject', 'topic']).optional(),
  topic: z.string().optional(),
});

export async function assessLevelTool(
  raw: unknown,
  ctx: AgentContext,
): Promise<ToolResult> {
  const args = assessLevelInput.parse(raw);
  const studentId = args.studentId || ctx.studentId;
  if (!studentId) {
    throw new Error('학생 ID(이름 또는 이메일)가 필요해요.');
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('student_attempts')
    .select('score, problem:problems(topic, difficulty)')
    .eq('student_id', studentId);
  if (error) throw new Error(error.message);

  type RawRow = {
    score: number | null;
    problem:
      | { topic: string | null; difficulty: string | null }
      | { topic: string | null; difficulty: string | null }[]
      | null;
  };
  type Row = {
    score: number | null;
    problem: { topic: string | null; difficulty: string | null } | null;
  };
  const rows: Row[] = ((data ?? []) as RawRow[]).map((r) => ({
    score: r.score,
    problem: Array.isArray(r.problem) ? (r.problem[0] ?? null) : r.problem,
  }));
  if (rows.length === 0) {
    return {
      kind: 'assess_level',
      result: {
        studentId,
        subject: '국사',
        levelOverall: 0,
        samples: 0,
        byTopic: [],
      },
    };
  }

  let sumW = 0;
  let sumWS = 0;
  const perTopic = new Map<string, { sumW: number; sumWS: number; count: number }>();
  for (const r of rows) {
    const w = WEIGHT[r.problem?.difficulty ?? 'medium'] ?? 1;
    const s = Math.max(0, Math.min(1, Number(r.score) || 0));
    sumW += w;
    sumWS += w * s;
    const topic = r.problem?.topic ?? '기타';
    const cur = perTopic.get(topic) ?? { sumW: 0, sumWS: 0, count: 0 };
    cur.sumW += w;
    cur.sumWS += w * s;
    cur.count += 1;
    perTopic.set(topic, cur);
  }

  const overall = Math.round((sumWS / sumW) * 100);
  const byTopic = Array.from(perTopic.entries())
    .map(([topic, v]) => ({
      topic,
      score: Math.round((v.sumWS / v.sumW) * 100),
      samples: v.count,
    }))
    .sort((a, b) => b.samples - a.samples);

  // upsert cache
  const upserts = [
    {
      student_id: studentId,
      subject: '국사',
      topic: null as string | null,
      score: overall,
      samples: rows.length,
      updated_at: new Date().toISOString(),
    },
    ...byTopic.map((t) => ({
      student_id: studentId,
      subject: '국사',
      topic: t.topic,
      score: t.score,
      samples: t.samples,
      updated_at: new Date().toISOString(),
    })),
  ];
  await supabase
    .from('student_levels')
    .upsert(upserts, { onConflict: 'student_id,subject,topic' });

  const result: LevelResult = {
    studentId,
    subject: '국사',
    levelOverall: overall,
    samples: rows.length,
    byTopic,
  };
  return { kind: 'assess_level', result };
}
