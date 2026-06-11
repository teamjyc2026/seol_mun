'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GraduationCap, LogOut, Plus } from 'lucide-react';
import type { School } from '@/entities/school';
import type { Student } from '@/shared/config/auth';
import type { AgentReply, ToolResult, Citation } from '@/shared/agent/types';
import type { AgentId } from '@/shared/agent/agents/types';
import { SUBJECTS, type Subject } from '@/shared/config/subjects';
import { cn } from '@/shared/lib/cn';
import { ChatInput, MessageBubble, type ChatMessage } from '@/widgets/agent-chat';
import { streamAgentMessage } from '@/features/send-agent-message';

type Conversation = { id: string; title: string; created_at: string };

type StoredMessage = {
  role: string;
  content: {
    text?: string;
    agent?: AgentId;
    toolResults?: ToolResult[];
    citations?: Citation[];
  } | null;
};

export function StudentAgentPage({
  student,
  schools,
}: {
  student: Pick<Student, 'id' | 'name' | 'grade'>;
  schools: School[];
}) {
  const router = useRouter();
  const [subject, setSubject] = useState<Subject>('영어');
  const [schoolId, setSchoolId] = useState<string | null>(schools[0]?.id ?? null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void refreshConversations();
  }, []);

  async function refreshConversations() {
    try {
      const res = await fetch('/api/student/conversations');
      if (!res.ok) return;
      const data = (await res.json()) as { conversations: Conversation[] };
      setConversations(data.conversations);
    } catch {
      // non-fatal
    }
  }

  async function openConversation(id: string) {
    setConversationId(id);
    setMessages([]);
    try {
      const res = await fetch(`/api/agent/conversations/${id}`);
      if (!res.ok) throw new Error('대화를 불러오지 못했어요.');
      const data = (await res.json()) as { messages: StoredMessage[] };
      setMessages(
        data.messages.flatMap<ChatMessage>((m) => {
          const text = m.content?.text ?? '';
          if (!text) return [];
          if (m.role === 'user') return [{ role: 'user', text }];
          if (m.role !== 'assistant') return [];
          const reply: AgentReply = {
            text,
            agent: m.content?.agent,
            toolResults: m.content?.toolResults ?? [],
            citations: m.content?.citations ?? [],
          };
          return [{ role: 'assistant', reply }];
        }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '대화를 불러오지 못했어요.');
    }
  }

  function newConversation() {
    setConversationId(null);
    setMessages([]);
  }

  async function logout() {
    await fetch('/api/student/logout', { method: 'POST' });
    router.refresh();
  }

  async function onSend() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(text);
  }

  /** 입력창 전송과 문제 카드의 "답 제출"이 공용으로 쓰는 전송 함수. */
  async function sendMessage(text: string) {
    if (!text || sending) return;
    setSending(true);

    let assistantIndex = -1;
    setMessages((prev) => {
      const next: ChatMessage[] = [
        ...prev,
        { role: 'user', text },
        {
          role: 'assistant',
          reply: { text: '', toolResults: [], citations: [] },
          streaming: true,
        },
      ];
      assistantIndex = next.length - 1;
      return next;
    });

    try {
      await streamAgentMessage(
        {
          conversationId,
          message: text,
          pinnedSourceIds: [],
          subject,
          schoolId,
        },
        {
          onMeta: (e) => {
            const isNew = !conversationId;
            setConversationId(e.conversationId);
            if (isNew) void refreshConversations();
            setMessages((prev) =>
              prev.map((m, i) =>
                i === assistantIndex && m.role === 'assistant'
                  ? {
                      ...m,
                      reply: {
                        ...m.reply,
                        agent: e.agent,
                        toolResults: e.toolResults,
                        citations: e.citations,
                      },
                    }
                  : m,
              ),
            );
          },
          onToken: (e) => {
            setMessages((prev) =>
              prev.map((m, i) =>
                i === assistantIndex && m.role === 'assistant'
                  ? { ...m, reply: { ...m.reply, text: m.reply.text + e.text } }
                  : m,
              ),
            );
          },
          onError: (msg) => {
            toast.error(msg);
            setMessages((prev) =>
              prev.map((m, i) =>
                i === assistantIndex && m.role === 'assistant'
                  ? { ...m, streaming: false }
                  : m,
              ),
            );
          },
          onDone: () => {
            setMessages((prev) =>
              prev.map((m, i) =>
                i === assistantIndex && m.role === 'assistant'
                  ? { ...m, streaming: false }
                  : m,
              ),
            );
          },
        },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '응답을 받지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-svh bg-zinc-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
            {student.name}님의 학습 · {subject}
          </h1>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
          >
            <LogOut className="h-3.5 w-3.5" /> 로그아웃
          </button>
        </header>

        {/* 대화 목록 */}
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm">
          <button
            type="button"
            onClick={newConversation}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
              conversationId === null
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
            )}
          >
            <Plus className="h-3 w-3" /> 새 대화
          </button>
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => openConversation(c.id)}
              className={cn(
                'max-w-44 shrink-0 truncate rounded-full border px-2.5 py-0.5 text-xs font-medium',
                c.id === conversationId
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
              )}
            >
              {c.title || '대화'}
            </button>
          ))}
        </div>

        {/* 과목 / 학교 */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                s === subject
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
              )}
            >
              {s}
            </button>
          ))}
          {schools.length > 0 && <span className="mx-1 h-4 w-px bg-zinc-200" />}
          {schools.map((sch) => {
            const active = sch.id === schoolId;
            return (
              <button
                key={sch.id}
                type="button"
                onClick={() => setSchoolId(active ? null : sch.id)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                  active
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                )}
              >
                🏫 {sch.name}
              </button>
            );
          })}
        </div>

        <div className="flex-1 space-y-4">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
              {'"Lesson 3 본문 외웠는지 확인해줘" / "관계대명사 문제 내줘" / "오늘 너무 피곤해.." '}
              <br />
              무엇이든 보내보세요. 틀린 유형은 기억해뒀다가 다시 물어봐드려요.
            </div>
          ) : (
            messages.map((m, i) => (
              <MessageBubble key={i} msg={m} onSubmitAnswer={(t) => void sendMessage(t)} />
            ))
          )}
        </div>

        <div className="sticky bottom-4">
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={onSend}
            isSending={sending}
            pinnedSources={[]}
            onTogglePin={() => {}}
            sources={[]}
          />
        </div>
      </div>
    </main>
  );
}
