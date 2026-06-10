import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { claudeJson } from '@/shared/config/anthropic';
import type { AgentId } from './agents/types';

export type MemoryKind =
  | 'fact'
  | 'preference'
  | 'joke'
  | 'emotion'
  | 'strength'
  | 'weakness'
  | 'progress';

export type AgentMemory = {
  kind: MemoryKind;
  content: string;
  created_at: string;
};

const LEARNING_KINDS: MemoryKind[] = ['strength', 'weakness', 'progress'];

/** 튜터링 에이전트 주입용: 학생의 강약점·진도 메모 블록. */
export function formatLearningMemories(memories: AgentMemory[]): string {
  const learning = memories.filter((m) => LEARNING_KINDS.includes(m.kind));
  if (learning.length === 0) return '';
  const lines = [...learning].reverse().map((m) => `- (${m.kind}) ${m.content}`);
  return `\n\n[학생 학습 프로필 — 이전 학습에서 기록됨]\n${lines.join('\n')}\n지침: weakness로 기록된 유형을 우선적으로 다시 출제·확인해 보완하고, 같은 유형을 또 틀리면 더 쉬운 단계부터 다시 다지세요. strength는 짧게 인정해주되 반복 출제는 줄이세요.`;
}

const MEMORY_LOAD_LIMIT = 30;

export async function loadMemories(studentId: string | null): Promise<AgentMemory[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('agent_memories')
    .select('kind, content, created_at')
    .eq('student_id', studentId ?? 'default')
    .order('created_at', { ascending: false })
    .limit(MEMORY_LOAD_LIMIT);
  if (error) {
    console.error('[memory] load failed:', error.message);
    return [];
  }
  return (data ?? []) as AgentMemory[];
}

/** System-prompt block listing remembered facts, oldest → newest. */
export function formatMemories(memories: AgentMemory[]): string {
  if (memories.length === 0) return '';
  const lines = [...memories]
    .reverse()
    .map((m) => `- (${m.kind}) ${m.content}`);
  return `\n\n[기억된 정보 — 이 사용자와의 이전 대화에서 저장됨]\n${lines.join('\n')}`;
}

const SOCIAL_EXTRACT_SYSTEM = (existing: string) =>
  `대화에서 다음 만남에도 기억할 가치가 있는 사용자 정보를 0~3개 추출하라.
- fact: 사용자에 대한 사실(반려동물, 학교, 시험 일정 등) / preference: 취향·선호 / joke: 둘만의 농담·밈 / emotion: 지속 관찰이 필요한 감정 상태(시험 불안 등)
- 한 항목은 한국어 한 문장, 3인칭 서술("고양이를 키운다").
- 일회성 잡담, 이미 "기존 기억" 목록에 있는 내용, 민감한 개인정보(주소·연락처 등)는 제외. 기억할 것이 없으면 빈 배열.
기존 기억:
${existing}`;

const LEARNING_EXTRACT_SYSTEM = (existing: string) =>
  `튜터링 대화에서 이 학생의 학습 상태를 추적할 메모를 0~3개 추출하라.
- weakness: 틀렸거나 헷갈려한 유형·개념 — 구체적으로 ("관계대명사 계속적 용법에서 which/that 구분을 틀림")
- strength: 잘 푼 유형·개념 ("빈칸 추론 문제를 근거 문장까지 짚으며 정확히 풀음")
- progress: 진도·반복 현황 ("Lesson 3 본문 암기 5/12 문장 완료, restored를 두 번 틀림")
- fact: 학습 관련 사실 (시험 일정, 목표 등)
- 한 항목은 한국어 한 문장. 채점·답변이 없는 단순 설명 턴이면 빈 배열.
- 이미 "기존 기억"에 같은 내용이 있으면 제외하되, 같은 약점을 또 틀린 경우는 "또 틀림"으로 새로 기록하라.
기존 기억:
${existing}`;

/**
 * After a turn, extract 0~3 memories and persist them.
 * - mode 'social' (companion/emotion): facts, preferences, jokes, feelings
 * - mode 'learning' (tutoring agents + identified student): strengths,
 *   weaknesses, progress — future turns re-quiz weak areas.
 * Designed to be awaited after the SSE 'done' event — failures only log.
 */
export async function extractAndSaveMemories(args: {
  studentId: string | null;
  agent: AgentId;
  userMessage: string;
  assistantText: string;
  mode?: 'social' | 'learning';
}): Promise<void> {
  try {
    const mode = args.mode ?? 'social';
    const recent = await loadMemories(args.studentId);
    const existingList = recent.map((m) => `- ${m.content}`).join('\n') || '(없음)';
    const kinds =
      mode === 'learning'
        ? ['weakness', 'strength', 'progress', 'fact']
        : ['fact', 'preference', 'joke', 'emotion'];
    const { memories } = await claudeJson<{
      memories: { kind: MemoryKind; content: string }[];
    }>({
      system:
        mode === 'learning'
          ? LEARNING_EXTRACT_SYSTEM(existingList)
          : SOCIAL_EXTRACT_SYSTEM(existingList),
      content: `사용자: ${args.userMessage.slice(0, 1000)}\n도우미(${args.agent}): ${args.assistantText.slice(0, 1500)}`,
      schema: {
        type: 'object',
        properties: {
          memories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: kinds },
                content: { type: 'string' },
              },
              required: ['kind', 'content'],
              additionalProperties: false,
            },
          },
        },
        required: ['memories'],
        additionalProperties: false,
      },
      maxTokens: 1024,
    });

    const existing = new Set(recent.map((m) => m.content.trim()));
    const fresh = (memories ?? [])
      .filter((m) => m.content?.trim() && !existing.has(m.content.trim()))
      .slice(0, 3);
    if (fresh.length === 0) return;

    const supabase = getSupabaseServer();
    const { error } = await supabase.from('agent_memories').insert(
      fresh.map((m) => ({
        student_id: args.studentId ?? 'default',
        agent: args.agent,
        kind: m.kind,
        content: m.content.trim(),
      })),
    );
    if (error) console.error('[memory] insert failed:', error.message);
  } catch (e) {
    console.error('[memory] extract failed:', e);
  }
}
