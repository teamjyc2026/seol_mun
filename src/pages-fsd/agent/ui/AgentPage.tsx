'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, FileText } from 'lucide-react';
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
import { AdminAccountMenu } from '@/widgets/admin-account-menu';

export function AgentPage({ initialSources }: { initialSources: Source[] }) {
  const { subject, setSubject } = useSubject();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [studentId, setStudentId] = useState('');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

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
    setInput('');

    try {
      await streamAgentMessage(
        {
          conversationId,
          message: text,
          pinnedSourceIds: pinnedIds,
          studentId: studentId.trim() || undefined,
          subject,
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
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-zinc-600 transition hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" /> 대시보드
            </Link>
            <h1 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
              🤖 학습 에이전트 · {subject}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/admin/agent/sources"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
              title="교재 업로드"
            >
              <BookOpen className="h-3.5 w-3.5" />
              교재 업로드
            </Link>
            <Link
              href="/admin/agent/problems"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
              title="문제 업로드"
            >
              <FileText className="h-3.5 w-3.5" />
              문제 업로드
            </Link>
            <AdminAccountMenu />
          </div>
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
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
              {`"${subject} 단원 객관식 3문제 만들어줘" 같이 입력해 보세요.`}
              <br />
              먼저 소스 PDF를 업로드하면 출처 인용까지 함께 나옵니다.
            </div>
          ) : (
            messages.map((m, i) => <MessageBubble key={i} msg={m} />)
          )}
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
