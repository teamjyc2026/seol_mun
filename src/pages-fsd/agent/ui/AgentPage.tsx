'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Source } from '@/entities/source';
import { SUBJECTS, type Subject } from '@/shared/config/subjects';
import { cn } from '@/shared/lib/cn';
import { useSubject } from '@/shared/store/subject';
import {
  ChatInput,
  MessageBubble,
  type ChatMessage,
} from '@/widgets/agent-chat';
import { streamAgentMessage } from '@/features/send-agent-message';

type Scope = {
  id: string;
  name: string;
  subject: string | null;
  grade: string | null;
  schoolName: string | null;
};

export function AgentPage({ initialSources }: { initialSources: Source[] }) {
  const { subject, setSubject } = useSubject();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [studentId, setStudentId] = useState('');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [scopesLoading, setScopesLoading] = useState(true);
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 메시지가 바뀌면(전송·스트리밍) 맨 아래로 스크롤.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/agent/scopes');
        if (!res.ok) return;
        const data = (await res.json()) as { scopes: Scope[] };
        setScopes(data.scopes ?? []);
      } catch {
        // non-fatal
      } finally {
        setScopesLoading(false);
      }
    })();
  }, []);

  function pickSubject(s: Subject) {
    setSubject(s);
  }

  const pinnedSources = useMemo(
    () => initialSources.filter((s) => pinnedIds.includes(s.id)),
    [initialSources, pinnedIds],
  );

  const subjectFilteredSources = useMemo(
    () =>
      initialSources.filter(
        (s) =>
          s.subject === subject ||
          (Array.isArray(s.subjects) && s.subjects.includes(subject)),
      ),
    [initialSources, subject],
  );

  async function onSend() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(text);
  }

  /** 시작 버튼: 사용자 메시지 없이 에이전트가 먼저 인사하게 하는 킥오프. */
  function kickoff() {
    void sendMessage(
      '(대화 시작) 학생에게 반말로 짧고 친근하게 인사하고, 오늘 뭘 공부하거나 어떤 문제를 풀지 가볍게 물어봐. 지금 바로 문제를 내지는 마.',
      { hidden: true },
    );
  }

  /** 입력창 전송과 문제 카드의 "답 제출"이 공용으로 쓰는 전송 함수.
   *  hidden=true면 사용자 말풍선 없이 에이전트 응답만(킥오프 등). */
  async function sendMessage(text: string, opts?: { hidden?: boolean }) {
    if (!text || sending) return;
    setSending(true);

    let assistantIndex = -1;
    setMessages((prev) => {
      const next: ChatMessage[] = [
        ...prev,
        ...(opts?.hidden ? [] : [{ role: 'user', text } as ChatMessage]),
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
          pinnedSourceIds: pinnedIds,
          studentId: studentId.trim() || undefined,
          subject,
          scopeId,
        },
        {
          onMeta: (e) => {
            setConversationId(e.conversationId);
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
                  ? {
                      ...m,
                      reply: { ...m.reply, text: m.reply.text + e.text },
                    }
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
            setMessages((prev) =>
              prev.map((m, i) =>
                i === assistantIndex && m.role === 'assistant'
                  ? {
                      ...m,
                      streaming: false,
                      // 서버가 마커를 떼어낸 최종 텍스트 + 선택지를 준다.
                      reply: { ...m.reply, text: e.text ?? m.reply.text, choices: e.choices ?? [] },
                    }
                  : m,
              ),
            );
          },
        },
      );
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : '응답을 받지 못했어요.';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  function togglePin(id: string) {
    setPinnedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <main className="min-h-svh bg-zinc-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
        <header className="flex items-center">
          <h1 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
            🤖 학습 에이전트 · {subject}
          </h1>
        </header>

        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm">
          <p className="mb-1.5 text-[11px] font-medium text-zinc-500">과목 선택</p>
          <div className="flex flex-wrap gap-1.5">
            {SUBJECTS.map((s) => {
              const active = s === subject;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => pickSubject(s)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                    active
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {scopesLoading ? (
          // 시험범위 칩 영역 — 로딩 중 자리를 잡아 레이아웃 시프트 방지.
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm">
            <div className="mb-1.5 h-3 w-56 animate-pulse rounded bg-zinc-100" />
            <div className="flex gap-1.5">
              <div className="h-6 w-14 animate-pulse rounded-full bg-zinc-100" />
              <div className="h-6 w-40 animate-pulse rounded-full bg-zinc-100" />
            </div>
          </div>
        ) : scopes.length > 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm">
            <p className="mb-1.5 text-[11px] font-medium text-zinc-500">
              학교 시험범위 (선택 시 그 범위 자료 기반으로 답변)
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setScopeId(null)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                  scopeId === null
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                )}
              >
                전체
              </button>
              {scopes.map((sc) => {
                const active = sc.id === scopeId;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setScopeId(active ? null : sc.id)}
                    title={[sc.schoolName, sc.name].filter(Boolean).join(' · ')}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                      active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                    )}
                  >
                    📘 {sc.schoolName ? `${sc.schoolName} · ` : ''}
                    {sc.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm">
          <span className="text-xs font-medium text-zinc-500">학생ID</span>
          <input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="(평가·실력 측정 시 필요)"
            className="flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-zinc-400"
          />
        </div>

        <div className="flex-1 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
              <p>
                {`"${subject} 단원 객관식 3문제 만들어줘" 같이 입력하거나,`}
                <br />
                아래 버튼으로 에이전트가 먼저 말 걸게 시작해 봐.
              </p>
              <button
                type="button"
                onClick={kickoff}
                disabled={sending}
                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                ▶ 대화 시작
              </button>
            </div>
          ) : (
            messages.map((m, i) => (
              <MessageBubble key={i} msg={m} onSubmitAnswer={(t) => void sendMessage(t)} />
            ))
          )}
          {(() => {
            // 마지막 에이전트 답변의 선택지를 퀵리플라이 버튼으로 — 누르면 그대로 전송.
            const last = messages[messages.length - 1];
            const choices =
              !sending && last?.role === 'assistant' && !last.streaming
                ? (last.reply.choices ?? [])
                : [];
            if (choices.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1.5">
                {choices.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => void sendMessage(c)}
                    className="rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                  >
                    {c}
                  </button>
                ))}
              </div>
            );
          })()}
          <div ref={bottomRef} />
        </div>

        <div className="sticky bottom-4">
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={onSend}
            isSending={sending}
            pinnedSources={pinnedSources}
            onTogglePin={togglePin}
            sources={subjectFilteredSources}
          />
        </div>
      </div>
    </main>
  );
}
