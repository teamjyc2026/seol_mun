import 'server-only';
import { CLAUDE_MODEL, getAnthropic } from '@/shared/config/anthropic';
import type { AgentId, Audience } from './types';

/**
 * High-precision keyword rules — a hit skips the LLM classification call.
 * Order matters: emotion outranks everything (a distressed message about
 * grammar should be cared for first), academic specialists outrank companion
 * (so "ㅋㅋ 문법 알려줘" still routes to grammar).
 */
const KEYWORD_RULES: { id: AgentId; patterns: RegExp[] }[] = [
  {
    id: 'emotion',
    patterns: [
      /힘들|힘드|우울|불안|초조|긴장돼|스트레스|짜증|화나|속상|슬퍼|슬프|눈물|울었|울고\s*싶|지쳤|지친|번아웃|포기하고\s*싶|자신감\s*없|망쳤|걱정돼|무서워|두려/,
    ],
  },
  {
    // 본문 암기 확인 — outranks problem_finder so "본문 빈칸 테스트 내줘"
    // starts a recitation check, not a problem search.
    id: 'recite',
    patterns: [
      /본문\s*(외|암기)|암기\s*(확인|테스트|체크|검사)|외웠는지|외웠나|외운\s*거|빈칸\s*(테스트|퀴즈)|영작\s*(테스트|확인)/,
    ],
  },
  {
    id: 'reading',
    patterns: [/독해|주제\s*(파악|찾)|요지|제목\s*추론|내용\s*(일치|불일치)|글의\s*(흐름|순서)|comprehension/i],
  },
  {
    // Explicit problem-search intent outranks topic keywords
    // ("관계대명사 문제 찾아줘" → problem_finder, not grammar).
    id: 'problem_finder',
    patterns: [/문제\s*(찾|보여|만들|내|출제|추천)|기출|비슷한\s*문제|풀\s*문제/i],
  },
  {
    id: 'grammar',
    patterns: [/문법|어법|시제|관계\s*대?명사|가정법|수동태|능동태|분사|동명사|to부정사|grammar|tense/i],
  },
  {
    id: 'vocab',
    patterns: [/단어|어휘|뜻이|무슨\s*뜻|의미|동의어|유의어|반의어|연어|숙어|vocab|collocation|meaning/i],
  },
  {
    id: 'socratic',
    patterns: [/소크라테스|산파술|스스로|혼자\s*풀|힌트만|단계적|유도\s*질문|guide me|don'?t tell/i],
  },
  {
    id: 'companion',
    patterns: [
      /잡담|수다|심심|농담|드립|웃긴\s*(얘기|이야기)?|재밌는\s*(얘기|이야기)|놀자|뭐\s*해\??$|뭐하고\s*있|^안녕|^하이|^ㅎㅇ|반가워|^ㅋㅋ+|^ㅎㅎ+|고마워|잘\s*자|굿나잇|밥\s*먹었/,
    ],
  },
];

/**
 * Supervisor: picks the specialist for this turn.
 * Cost: 0 LLM calls on a keyword hit or a non-English subject; otherwise a
 * single tiny structured-output classification call.
 */
export async function classifyAgent(
  message: string,
  opts: { subject: string; audience: Audience; lastAgent?: AgentId | null },
): Promise<{
  agent: AgentId;
  confidence: number;
  via: 'keyword' | 'llm' | 'default' | 'history';
}> {
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((re) => re.test(message))) {
      return { agent: rule.id, confidence: 0.9, via: 'keyword' };
    }
  }
  // Tutoring-loop continuation: a turn with no new intent ("③번이요",
  // "casualties 아닌가?", "왜?") is almost always an answer/follow-up to the
  // previous specialist — keep the same agent so the loop doesn't break.
  if (opts.lastAgent && opts.lastAgent !== 'general') {
    return { agent: opts.lastAgent, confidence: 0.7, via: 'history' };
  }
  // The grammar/vocab/socratic specialists are English-focused. For other
  // subjects, default to general immediately and skip the extra LLM call.
  // (companion/emotion are subject-independent but keyword-routed above.)
  if (opts.subject !== '영어') {
    return { agent: 'general', confidence: 0.5, via: 'default' };
  }
  try {
    const client = getAnthropic();
    const res = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 256,
      system:
        '사용자 메시지를 다음 중 하나로 분류해 JSON으로만 답하라: socratic(스스로 풀도록 유도/답을 직접 알려주지 말 것), grammar(영어 문법), vocab(영어 어휘·단어 뜻), problem_finder(문제 검색·출제), recite(교과서 본문 암기 확인·빈칸 테스트·영작 확인), reading(독해력 점검·주제/요지/추론 질문), companion(인사·잡담·농담 등 학습과 무관한 가벼운 대화), emotion(스트레스·불안·슬픔 등 감정 표현이 중심), general(그 외).',
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              agent: {
                type: 'string',
                enum: [
                  'socratic',
                  'grammar',
                  'vocab',
                  'problem_finder',
                  'recite',
                  'reading',
                  'companion',
                  'emotion',
                  'general',
                ],
              },
              confidence: { type: 'number' },
            },
            required: ['agent'],
            additionalProperties: false,
          },
        },
      },
      messages: [{ role: 'user', content: message.slice(0, 600) }],
    });
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('');
    const parsed = JSON.parse(text || '{}') as {
      agent?: AgentId;
      confidence?: number;
    };
    return {
      agent: parsed.agent ?? 'general',
      confidence: parsed.confidence ?? 0.5,
      via: 'llm',
    };
  } catch {
    return { agent: 'general', confidence: 0, via: 'default' };
  }
}
