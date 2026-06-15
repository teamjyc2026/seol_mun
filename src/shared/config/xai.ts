import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';

/**
 * xAI(Grok) — 교감(companion/emotion) 에이전트 전용. OpenAI 호환 API라
 * SDK 없이 raw fetch + SSE로 스트리밍한다(무의존). 키는 .env.local에만.
 */
export const XAI_MODEL = process.env.XAI_MODEL || 'grok-4.20-0309-non-reasoning';

function getXaiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error('XAI_API_KEY is not set');
  return key;
}

/** Anthropic 메시지(role/content 문자열) → Grok 채팅 스트림 텍스트 델타. */
export async function* streamGrokText(params: {
  system: string;
  messages: Anthropic.MessageParam[];
}): AsyncGenerator<string, void, void> {
  const messages = [
    { role: 'system', content: params.system },
    ...params.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
  ];

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getXaiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: XAI_MODEL, messages, max_tokens: 1024, stream: true }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Grok 호출 실패 (${res.status}) ${detail.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta as string;
        } catch {
          // 부분 라인 — 무시
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
