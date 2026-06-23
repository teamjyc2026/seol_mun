import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { claudeJson } from '@/shared/config/anthropic';
import { embedQuery } from '@/shared/lib/embedding';

/** 방 회상에 쓸 최소 유사도 — 너무 낮으면 무관한 과거 방이 섞인다. */
const RECALL_MIN_SIMILARITY = 0.55;
const SUMMARY_MSG_LIMIT = 16;

/**
 * 한 방(대화)을 요약·임베딩해 agent_conversations.summary/embedding에 저장한다.
 * SSE 'done' 이후 비동기로 호출 — 실패는 로그만. 매 학생 턴마다 최신 요약으로 갱신.
 */
export async function summarizeAndEmbedConversation(args: {
  conversationId: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseServer();
    const { data: rows } = await supabase
      .from('agent_messages')
      .select('role, content, created_at')
      .eq('conversation_id', args.conversationId)
      .order('created_at', { ascending: false })
      .limit(SUMMARY_MSG_LIMIT);
    const msgs = (rows ?? []).reverse();
    if (msgs.length === 0) return;

    const transcript = msgs
      .map((r) => {
        const text = ((r.content as { text?: string } | null)?.text ?? '')
          .replace(/\[비공개[^\]]*\][^\n]*/g, '')
          .slice(0, 600)
          .trim();
        if (!text) return '';
        return `${r.role === 'user' ? '학생' : '도우미'}: ${text}`;
      })
      .filter(Boolean)
      .join('\n');
    if (!transcript) return;

    const { summary } = await claudeJson<{ summary: string }>({
      system: `학생-AI 튜터 대화를 다음에 이 학생을 다시 만났을 때 떠올릴 용도로 한국어 1~3문장으로 요약하라.
- 다룬 과목·단원·주제, 풀어본 문제 유형, 학생이 어려워하거나 틀린 부분, 진도를 담아라.
- 인사·잡담은 빼고 학습 내용 위주. 결과는 지정 JSON으로만.`,
      content: transcript.slice(0, 6000),
      schema: {
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
        additionalProperties: false,
      },
      maxTokens: 512,
    });
    const clean = (summary ?? '').trim();
    if (!clean) return;

    const embedding = await embedQuery(clean);
    const { error } = await supabase
      .from('agent_conversations')
      .update({
        summary: clean,
        embedding: embedding as unknown as number[],
        embedded_at: new Date().toISOString(),
      })
      .eq('id', args.conversationId);
    if (error) console.error('[roomMemory] update failed:', error.message);
  } catch (e) {
    console.error('[roomMemory] summarize/embed failed:', e);
  }
}

/**
 * 이 학생의 과거 방(대화) 중 현재 메시지와 의미적으로 가까운 것들을 떠올려
 * 시스템 프롬프트에 주입할 블록 문자열을 만든다. 없으면 ''.
 * (현재 방은 exclude — 직전 턴은 history로 이미 들어감.)
 */
export async function recallRooms(args: {
  studentId: string;
  message: string;
  excludeConvId: string;
  k?: number;
}): Promise<string> {
  try {
    const embedding = await embedQuery(args.message);
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.rpc('match_conversations', {
      query_embedding: embedding as unknown as number[],
      filter_student_id: args.studentId,
      match_count: args.k ?? 3,
      exclude_id: args.excludeConvId,
    });
    if (error) {
      console.error('[roomMemory] match_conversations failed:', error.message);
      return '';
    }
    const rooms = (data ?? []) as {
      title: string | null;
      summary: string | null;
      created_at: string;
      similarity: number;
    }[];
    const relevant = rooms.filter(
      (r) => r.summary && r.similarity >= RECALL_MIN_SIMILARITY,
    );
    if (relevant.length === 0) return '';
    const lines = relevant.map((r) => {
      const date = r.created_at.slice(0, 10);
      return `- (${date}) ${r.title ? `${r.title}: ` : ''}${r.summary}`;
    });
    return `\n\n[이 학생의 관련된 과거 대화 — 참고]\n${lines.join('\n')}\n지침: 위 과거 맥락을 자연스럽게 이어 답하되, 학생이 묻지 않은 과거 내용을 굳이 들추진 마세요.`;
  } catch (e) {
    console.error('[roomMemory] recall failed:', e);
    return '';
  }
}
