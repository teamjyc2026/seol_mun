import 'server-only';
import { z } from 'zod';
import { Type } from '@google/genai';
import { GEMINI_GENERATION_MODEL, getGemini } from '@/shared/config/gemini';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { buildEvaluationPrompt } from '../prompts';
import type { AgentContext, ToolResult } from '../types';

export const evaluateAnswerInput = z.object({
  problemId: z.string().uuid(),
  studentAnswer: z.string().min(1),
  studentId: z.string().min(1).optional(),
});

export async function evaluateAnswerTool(
  raw: unknown,
  ctx: AgentContext,
): Promise<ToolResult> {
  const args = evaluateAnswerInput.parse(raw);
  const studentId = args.studentId || ctx.studentId;
  if (!studentId) {
    throw new Error('학생 ID(이름 또는 이메일)가 필요해요.');
  }

  const supabase = getSupabaseServer();
  const { data: problem, error: probErr } = await supabase
    .from('problems')
    .select('id, problem_type, question, choices, answer, explanation, difficulty, topic')
    .eq('id', args.problemId)
    .maybeSingle();
  if (probErr || !problem) {
    throw new Error('문제를 찾을 수 없어요.');
  }

  const userPrompt = `문제: ${problem.question}
보기: ${problem.choices ? JSON.stringify(problem.choices) : '(없음)'}
정답: ${problem.answer}
해설: ${problem.explanation ?? '(없음)'}
유형: ${problem.problem_type}

학생 답안: ${args.studentAnswer}

위 문제·정답을 기준으로 학생 답안을 평가하라.`;

  const client = getGemini();
  const res = await client.models.generateContent({
    model: GEMINI_GENERATION_MODEL,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: buildEvaluationPrompt(),
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isCorrect: { type: Type.BOOLEAN },
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
        },
        required: ['isCorrect', 'score', 'feedback'],
      },
      temperature: 0.1,
    },
  });

  type EvalRaw = { isCorrect: boolean; score: number; feedback: string };
  const parsed = JSON.parse(res.text ?? '{}') as EvalRaw;
  const score = Math.max(0, Math.min(1, Number(parsed.score) || 0));

  const { data: attempt, error: insErr } = await supabase
    .from('student_attempts')
    .insert({
      problem_id: problem.id,
      student_id: studentId,
      student_answer: args.studentAnswer,
      is_correct: parsed.isCorrect,
      score,
      feedback: parsed.feedback,
    })
    .select('id')
    .single();
  if (insErr || !attempt) {
    throw new Error(insErr?.message ?? 'attempt insert failed');
  }

  return {
    kind: 'evaluate_answer',
    result: {
      problemId: problem.id,
      isCorrect: !!parsed.isCorrect,
      score,
      feedback: parsed.feedback,
      studentId,
      attemptId: attempt.id,
    },
  };
}
