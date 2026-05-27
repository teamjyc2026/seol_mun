import { api } from '@/shared/api/axios';
import type { AgentReply } from '@/shared/agent/types';

export type SendMessageInput = {
  conversationId: string | null;
  message: string;
  pinnedSourceIds: string[];
  studentId?: string;
};

export type SendMessageResult = {
  conversationId: string;
  reply: AgentReply;
};

export async function sendAgentMessage(
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const { data } = await api.post<SendMessageResult>('/agent/chat', input, {
    timeout: 120_000,
  });
  return data;
}
