import 'server-only';
import { Type } from '@google/genai';
import { GEMINI_GENERATION_MODEL, getGemini } from '@/shared/config/gemini';
import type { AgentId, Audience } from './types';

/** High-precision keyword rules — a hit skips the LLM classification call. */
const KEYWORD_RULES: { id: AgentId; patterns: RegExp[] }[] = [
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
    id: 'problem_finder',
    patterns: [/문제\s*(찾|보여|만들|내|출제|추천)|기출|비슷한\s*문제|풀\s*문제/i],
  },
];

/**
 * Supervisor: picks the specialist for this turn.
 * Cost: 0 LLM calls on a keyword hit or a non-English subject; otherwise a
 * single temp-0, tiny-JSON classification call.
 */
export async function classifyAgent(
  message: string,
  opts: { subject: string; audience: Audience },
): Promise<{ agent: AgentId; confidence: number; via: 'keyword' | 'llm' | 'default' }> {
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((re) => re.test(message))) {
      return { agent: rule.id, confidence: 0.9, via: 'keyword' };
    }
  }
  // The grammar/vocab/socratic specialists are English-focused. For other
  // subjects, default to general immediately and skip the extra LLM call.
  if (opts.subject !== '영어') {
    return { agent: 'general', confidence: 0.5, via: 'default' };
  }
  try {
    const client = getGemini();
    const res = await client.models.generateContent({
      model: GEMINI_GENERATION_MODEL,
      contents: [{ role: 'user', parts: [{ text: message.slice(0, 600) }] }],
      config: {
        systemInstruction:
          '사용자 메시지를 다음 중 하나로 분류해 JSON으로만 답하라: socratic(스스로 풀도록 유도/답을 직접 알려주지 말 것), grammar(영어 문법), vocab(영어 어휘·단어 뜻), problem_finder(문제 검색·출제), general(그 외).',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            agent: {
              type: Type.STRING,
              enum: ['socratic', 'grammar', 'vocab', 'problem_finder', 'general'],
            },
            confidence: { type: Type.NUMBER },
          },
          required: ['agent'],
        },
        temperature: 0,
      },
    });
    const parsed = JSON.parse(res.text ?? '{}') as {
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
