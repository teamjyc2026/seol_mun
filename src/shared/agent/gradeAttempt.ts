import 'server-only';
import { claudeJson } from '@/shared/config/anthropic';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { buildEvaluationPrompt } from './prompts';
import type { ProblemDraft } from './types';

/**
 * 학생 채팅용 조용한 자동 채점.
 *
 * 학생 모드에선 evaluate_answer 도구가 막혀 있어(정답 노출 방지) 채점이 LLM
 * 프롬프트 메모로만 일어나고 구조적으로 저장되지 않는다. 이 함수는 직전 턴에
 * 출제된 문제와 학생의 답 메시지를 받아 서버에서 조용히 채점하고
 * student_attempts에 기록한다 — 채팅 스트림/마스킹은 건드리지 않는다.
 *
 * SSE 'done' 이후 await로 호출(메모리 추출과 동일) — UI는 대기하지 않고,
 * 실패는 로그만 남긴다.
 */
export async function gradeStudentAttempt(args: {
  /** 직전 어시스턴트 턴에 출제된 (저장된) 문제 — id 필수. */
  servedProblem: ProblemDraft;
  /** 이번 턴 학생 메시지(답으로 추정). */
  studentMessage: string;
  /** 로그인 학생 세션 id(uuid). */
  studentId: string;
  conversationId: string;
  subject: string;
}): Promise<void> {
  try {
    const p = args.servedProblem;
    if (!p.id) return; // 저장 안 된(생성) 문제는 기록 불가 — problem_id FK 필요.

    const userPrompt = `문제: ${p.question}
보기: ${p.choices ? JSON.stringify(p.choices) : '(없음)'}
정답: ${p.answer}
해설: ${p.explanation ?? '(없음)'}
유형: ${p.problem_type}

학생 메시지: ${args.studentMessage}

학생 메시지가 위 문제에 대한 "답안"이면 isAttempt=true로 채점하고, 답이 아니라
질문·잡담·다음 문제 요청 등이면 isAttempt=false로 두라(채점값은 무시됨).`;

    type GradeRaw = {
      isAttempt: boolean;
      isCorrect: boolean;
      score: number;
      feedback: string;
    };
    const parsed = await claudeJson<GradeRaw>({
      system: buildEvaluationPrompt(args.subject),
      content: userPrompt,
      schema: {
        type: 'object',
        properties: {
          isAttempt: { type: 'boolean' },
          isCorrect: { type: 'boolean' },
          score: { type: 'number' },
          feedback: { type: 'string' },
        },
        required: ['isAttempt', 'isCorrect', 'score', 'feedback'],
        additionalProperties: false,
      },
      maxTokens: 1024,
    });

    // 답이 아닌 턴(질문·잡담)은 기록하지 않는다.
    if (!parsed.isAttempt) return;

    const score = Math.max(0, Math.min(1, Number(parsed.score) || 0));
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('student_attempts').insert({
      problem_id: p.id,
      student_id: args.studentId,
      student_answer: args.studentMessage.slice(0, 2000),
      is_correct: parsed.isCorrect,
      score,
      feedback: parsed.feedback,
      conversation_id: args.conversationId,
    });
    if (error) console.error('[gradeAttempt] insert failed:', error.message);
  } catch (e) {
    console.error('[gradeAttempt] failed:', e);
  }
}
