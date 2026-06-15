import type { StreamEvent } from '@/shared/agent/types';

export type StreamMessageInput = {
  conversationId: string | null;
  message: string;
  pinnedSourceIds: string[];
  studentId?: string;
  subject?: string;
  /** 학교별 RAG: scope retrieval to this school's sources. */
  schoolId?: string | null;
  /** 시험범위 RAG: scope retrieval to this exam scope's sources. */
  scopeId?: string | null;
};

export type StreamHandlers = {
  onMeta?: (e: Extract<StreamEvent, { kind: 'meta' }>) => void;
  onToken?: (e: Extract<StreamEvent, { kind: 'token' }>) => void;
  onError?: (msg: string) => void;
  onDone?: (e: Extract<StreamEvent, { kind: 'done' }>) => void;
};

/**
 * Stream `/api/agent/chat` SSE events to the supplied handlers.
 * Resolves when the stream is fully consumed.
 */
export async function streamAgentMessage(
  input: StreamMessageInput,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = '응답을 받지 못했어요.';
    try {
      const data = JSON.parse(text);
      msg = data.message ?? msg;
    } catch {
      // ignore
    }
    handlers.onError?.(msg);
    return;
  }
  const reader = res.body?.getReader();
  if (!reader) {
    handlers.onError?.('스트림을 열 수 없어요.');
    return;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (!raw.startsWith('data:')) continue;
        const json = raw.slice(5).trim();
        if (!json) continue;
        try {
          const event = JSON.parse(json) as StreamEvent;
          if (event.kind === 'meta') handlers.onMeta?.(event);
          else if (event.kind === 'token') handlers.onToken?.(event);
          else if (event.kind === 'error') handlers.onError?.(event.message);
          else if (event.kind === 'done') {
            handlers.onDone?.(event);
            return;
          }
        } catch {
          // skip malformed line
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
