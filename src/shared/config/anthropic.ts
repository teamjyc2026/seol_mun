import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_MODEL = 'claude-opus-4-8';

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  // overloaded(529)·rate-limit(429)·5xx는 SDK가 지수백오프로 재시도 — 횟수를 늘려
  // 일시적 과부하는 대개 자동 회복되게 한다.
  cached = new Anthropic({ apiKey, maxRetries: 5 });
  return cached;
}

/**
 * LLM 에러를 사용자용 한국어 메시지로 변환 — overloaded/rate-limit 등 원본 JSON
 * 대신 안내문을 보여준다(라우트 응답·토스트에서 사용).
 */
export function llmErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const status = (e as { status?: number } | null)?.status;
  if (status === 529 || /overload/i.test(msg))
    return 'AI 서버가 잠시 혼잡해요. 잠깐 뒤 다시 시도해 주세요.';
  if (status === 429 || /rate.?limit/i.test(msg))
    return '요청이 너무 많아요. 잠깐 뒤 다시 시도해 주세요.';
  if (/timeout|etimedout|abort/i.test(msg))
    return '응답이 지연됐어요. 다시 시도해 주세요.';
  return msg;
}

/**
 * One-shot structured-output call: returns the parsed JSON matching `schema`.
 * Opus 4.8 rejects temperature/top_p/top_k — steer with the prompt instead.
 */
export type TokenUsage = { input: number; output: number };

export async function claudeJson<T>(args: {
  system?: string;
  content: string | Anthropic.ContentBlockParam[];
  schema: Record<string, unknown>;
  maxTokens?: number;
  /** 토큰 사용량 보고 (호출 측에서 노출용으로 받음). */
  onUsage?: (usage: TokenUsage) => void;
}): Promise<T> {
  const client = getAnthropic();
  // Always stream — large structured outputs (OCR, problem extraction) would
  // hit HTTP timeouts on a non-streaming request.
  const stream = client.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: args.maxTokens ?? 4096,
    ...(args.system ? { system: args.system } : {}),
    output_config: {
      format: { type: 'json_schema', schema: args.schema },
    },
    messages: [{ role: 'user', content: args.content }],
  });
  const res = await stream.finalMessage();
  args.onUsage?.({ input: res.usage.input_tokens, output: res.usage.output_tokens });
  if (res.stop_reason === 'max_tokens') {
    throw new Error('구조화 출력이 max_tokens에서 잘렸습니다.');
  }
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return JSON.parse(text) as T;
}
