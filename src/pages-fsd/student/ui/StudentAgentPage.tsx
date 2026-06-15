'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LogOut, Plus } from 'lucide-react';
import type { Student } from '@/shared/config/auth';
import type { AgentReply, ToolResult, Citation } from '@/shared/agent/types';
import type { AgentId } from '@/shared/agent/agents/types';
import { DEFAULT_QUICK_REPLIES, parseQuickReplies } from '@/shared/agent/quickReplies';
import { parseSolveStage } from '@/shared/agent/solveStage';
import { SUBJECTS, type Subject } from '@/shared/config/subjects';
import { cn } from '@/shared/lib/cn';
import {
  MASCOT_NAME,
  MascotAvatar,
  QuickReplies,
  SolveStepper,
  StudentAssistantMessage,
  StudentBubble,
  StudentChatInput,
  SUBJECT_EMOJI,
} from '@/widgets/student-chat';
import { streamAgentMessage } from '@/features/send-agent-message';

type Conversation = { id: string; title: string; created_at: string };

type Scope = {
  id: string;
  name: string;
  subject: string | null;
  grade: string | null;
  schoolName: string | null;
};

type StoredMessage = {
  role: string;
  content: {
    text?: string;
    agent?: AgentId;
    toolResults?: ToolResult[];
    citations?: Citation[];
    choices?: string[];
    stage?: number;
  } | null;
};

type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; reply: AgentReply; streaming?: boolean };

export function StudentAgentPage({
  student,
}: {
  student: Pick<Student, 'id' | 'name' | 'grade'>;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState<Subject>('영어');
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  /** 문제 풀이 코칭 진행 단계 (1~5, null=풀이 중 아님). */
  const [solveStage, setSolveStage] = useState<number | null>(null);

  useEffect(() => {
    void refreshConversations();
    void loadScopes();
  }, []);

  async function loadScopes() {
    try {
      const res = await fetch('/api/agent/scopes');
      if (!res.ok) return;
      const data = (await res.json()) as { scopes: Scope[] };
      setScopes(data.scopes ?? []);
    } catch {
      // non-fatal
    }
  }

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
    setSolveStage(null);
    try {
      const res = await fetch(`/api/agent/conversations/${id}`);
      if (!res.ok) throw new Error('대화를 불러오지 못했어요.');
      const data = (await res.json()) as { messages: StoredMessage[] };
      // 마지막으로 기록된 풀이 단계 복원
      const lastStage = [...data.messages]
        .reverse()
        .find((m) => m.role === 'assistant' && m.content?.stage != null);
      setSolveStage(lastStage?.content?.stage ?? null);
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
            choices: m.content?.choices ?? [],
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
    setSolveStage(null);
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

  /** 입력창 전송·퀵리플라이 탭·문제 카드 "답 제출"이 공용으로 쓰는 전송 함수. */
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
          scopeId,
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
          onDone: (e) => {
            if (e.stage != null) setSolveStage(e.stage);
            setMessages((prev) =>
              prev.map((m, i) => {
                if (i !== assistantIndex || m.role !== 'assistant') return m;
                // 서버가 단계 마커·트레일러를 분리해 보내준다 — 누적 텍스트도 정제.
                const staged = parseSolveStage(m.reply.text);
                const parsed = parseQuickReplies(staged.text);
                return {
                  ...m,
                  streaming: false,
                  reply: {
                    ...m.reply,
                    text: parsed.text,
                    choices: e.choices?.length ? e.choices : parsed.choices,
                  },
                };
              }),
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

  const lastAssistantIndex = messages.reduce(
    (acc, m, i) => (m.role === 'assistant' ? i : acc),
    -1,
  );

  return (
    <main className="min-h-svh bg-gradient-to-b from-orange-50/70 via-white to-white">
      <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-3 px-4 py-5 sm:px-6">
        <header className="flex items-center gap-3">
          <MascotAvatar size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold tracking-tight text-zinc-900">
              {MASCOT_NAME}
            </h1>
            <p className="truncate text-xs font-medium text-orange-600">
              {student.name}랑 공부 중! {SUBJECT_EMOJI[subject]} {subject}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1 rounded-full border-2 border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-500 hover:bg-zinc-50"
          >
            <LogOut className="h-3.5 w-3.5" /> 나가기
          </button>
        </header>

        {/* 대화 목록 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={newConversation}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border-2 px-3 py-1 text-xs font-bold transition',
              conversationId === null
                ? 'border-orange-400 bg-orange-100 text-orange-700'
                : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50',
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
                'max-w-44 shrink-0 truncate rounded-full border-2 px-3 py-1 text-xs font-bold transition',
                c.id === conversationId
                  ? 'border-orange-400 bg-orange-100 text-orange-700'
                  : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50',
              )}
            >
              {c.title || '대화'}
            </button>
          ))}
        </div>

        {/* 과목 / 시험범위 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
              className={cn(
                'inline-flex min-h-9 items-center gap-1 rounded-full border-2 border-b-4 px-3 py-1 text-xs font-bold transition active:translate-y-[2px] active:border-b-2',
                s === subject
                  ? 'border-orange-400 bg-orange-100 text-orange-700'
                  : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50',
              )}
            >
              {SUBJECT_EMOJI[s]} {s}
            </button>
          ))}
          {scopes.map((sc) => {
            const active = sc.id === scopeId;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => setScopeId(active ? null : sc.id)}
                title={[sc.schoolName, sc.name].filter(Boolean).join(' · ')}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1 rounded-full border-2 border-b-4 px-3 py-1 text-xs font-bold transition active:translate-y-[2px] active:border-b-2',
                  active
                    ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                    : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50',
                )}
              >
                📘 {sc.name}
              </button>
            );
          })}
        </div>

        {/* 문제 풀이 코칭 스테퍼 — 풀이 시작하면 채팅 위에 떠 있는다 */}
        {solveStage != null && (
          <div className="sticky top-2 z-10 rounded-2xl border-2 border-orange-100 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
            <SolveStepper stage={solveStage} />
          </div>
        )}

        <div className="flex-1 space-y-4 py-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-orange-200 bg-white/70 px-6 py-10 text-center">
              <MascotAvatar size="xl" />
              <div>
                <p className="text-lg font-extrabold text-zinc-900">
                  안녕! 나는 {MASCOT_NAME} 🦊
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  같이 놀면서 공부하자! 뭐부터 해볼까?
                </p>
              </div>
              <QuickReplies
                big
                choices={DEFAULT_QUICK_REPLIES}
                onPick={(label) => void sendMessage(label)}
                disabled={sending}
              />
            </div>
          ) : (
            messages.map((m, i) =>
              m.role === 'user' ? (
                <StudentBubble key={i} role="user" text={m.text} />
              ) : (
                <StudentAssistantMessage
                  key={i}
                  reply={m.reply}
                  streaming={m.streaming}
                  isLast={i === lastAssistantIndex}
                  sending={sending}
                  onQuickReply={(label) => void sendMessage(label)}
                  onSubmitAnswer={(t) => void sendMessage(t)}
                />
              ),
            )
          )}
        </div>

        <div className="sticky bottom-4">
          <StudentChatInput
            value={input}
            onChange={setInput}
            onSend={() => void onSend()}
            isSending={sending}
          />
        </div>
      </div>
    </main>
  );
}
