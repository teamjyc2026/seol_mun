import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { claudeJson } from '@/shared/config/anthropic';
import type { AgentId } from './agents/types';

export type AgentMemory = {
  kind: 'fact' | 'preference' | 'joke' | 'emotion';
  content: string;
  created_at: string;
};

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

/**
 * After a companion/emotion turn, extract 0~3 facts worth remembering and
 * persist them. Designed to be awaited after the SSE 'done' event — failures
 * only log.
 */
export async function extractAndSaveMemories(args: {
  studentId: string | null;
  agent: AgentId;
  userMessage: string;
  assistantText: string;
}): Promise<void> {
  try {
    const recent = await loadMemories(args.studentId);
    const { memories } = await claudeJson<{
      memories: { kind: 'fact' | 'preference' | 'joke' | 'emotion'; content: string }[];
    }>({
      system: `대화에서 다음 만남에도 기억할 가치가 있는 사용자 정보를 0~3개 추출하라.
- fact: 사용자에 대한 사실(반려동물, 학교, 시험 일정 등) / preference: 취향·선호 / joke: 둘만의 농담·밈 / emotion: 지속 관찰이 필요한 감정 상태(시험 불안 등)
- 한 항목은 한국어 한 문장, 3인칭 서술("고양이를 키운다").
- 일회성 잡담, 이미 "기존 기억" 목록에 있는 내용, 민감한 개인정보(주소·연락처 등)는 제외. 기억할 것이 없으면 빈 배열.
기존 기억:
${recent.map((m) => `- ${m.content}`).join('\n') || '(없음)'}`,
      content: `사용자: ${args.userMessage.slice(0, 1000)}\n도우미(${args.agent}): ${args.assistantText.slice(0, 1000)}`,
      schema: {
        type: 'object',
        properties: {
          memories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['fact', 'preference', 'joke', 'emotion'] },
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
