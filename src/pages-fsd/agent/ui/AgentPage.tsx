'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { Source } from '@/entities/source';
import {
  ChatInput,
  MessageBubble,
  SourceDrawer,
  type ChatMessage,
} from '@/widgets/agent-chat';
import { useSendAgentMessage } from '@/features/send-agent-message';

export function AgentPage({ initialSources }: { initialSources: Source[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [studentId, setStudentId] = useState('');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  const pinnedSources = useMemo(
    () => initialSources.filter((s) => pinnedIds.includes(s.id)),
    [initialSources, pinnedIds],
  );

  const send = useSendAgentMessage({
    onSuccess: (r) => {
      setConversationId(r.conversationId);
      setMessages((prev) => [...prev, { role: 'assistant', reply: r.reply }]);
    },
    onError: (err) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : '응답을 받지 못했어요.';
      toast.error(msg);
    },
  });

  function onSend() {
    const text = input.trim();
    if (!text || send.isPending) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    send.mutate({
      conversationId,
      message: text,
      pinnedSourceIds: pinnedIds,
      studentId: studentId.trim() || undefined,
    });
  }

  function togglePin(id: string) {
    setPinnedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <main className="min-h-svh bg-zinc-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-zinc-600 transition hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" /> 대시보드
            </Link>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">
            🤖 학습 에이전트 · 국사
          </h1>
          <div className="flex items-center gap-1">
            <Link
              href="/admin/agent/sources"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
              title="소스 라이브러리"
            >
              <BookOpen className="h-3.5 w-3.5" />
              소스 {initialSources.length}
            </Link>
            <Link
              href="/admin/agent/problems"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
              title="문제 라이브러리"
            >
              <FileText className="h-3.5 w-3.5" />
              문제
            </Link>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
              title="빠른 핀/업로드"
            >
              핀
            </button>
          </div>
        </header>

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
              "임진왜란 단원 객관식 3문제 만들어줘" 같이 입력해 보세요.
              <br />
              먼저 소스 PDF를 업로드하면 출처 인용까지 함께 나옵니다.
            </div>
          ) : (
            messages.map((m, i) => <MessageBubble key={i} msg={m} />)
          )}
          {send.isPending ? (
            <div className="max-w-[60%] rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500">
              생각 중…
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-4">
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={onSend}
            isSending={send.isPending}
            pinnedSources={pinnedSources}
            onTogglePin={togglePin}
            sources={initialSources}
          />
        </div>
      </div>

      <SourceDrawer
        sources={initialSources}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </main>
  );
}
