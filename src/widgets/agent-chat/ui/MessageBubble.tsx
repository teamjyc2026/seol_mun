'use client';

import type { AgentReply, ToolResult } from '@/shared/agent/types';
import { AGENT_LABELS, AGENT_TEXT_CLASS } from '@/shared/agent/agents/styles';
import { Markdown } from '@/shared/ui/Markdown/Markdown';
import { cn } from '@/shared/lib/cn';
import { openSourcePdf } from '@/features/open-source-pdf';
import { ProblemCard } from './ProblemCard';
import { EvaluationCard } from './EvaluationCard';
import { LevelCard } from './LevelCard';
import { CitationChip } from './CitationChip';

export type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; reply: AgentReply; streaming?: boolean };

export function MessageBubble({
  msg,
  onSubmitAnswer,
}: {
  msg: ChatMessage;
  /** 출제 카드에서 답 제출 시 채팅 메시지로 전송 (없으면 정적 카드). */
  onSubmitAnswer?: (text: string) => void;
}) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2.5 text-sm text-white whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }
  const r = msg.reply;
  const streaming = msg.streaming;
  const styled = !!r.agent && r.agent !== 'general';
  // Prefix the specialist `[말머리]` inline so it flows with the first line.
  const body = styled && r.text ? `**[${AGENT_LABELS[r.agent!]}]** ${r.text}` : r.text;
  return (
    <div className="space-y-3">
      {r.text || streaming ? (
        <div
          className={cn(
            'max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2.5 text-sm leading-relaxed',
            styled ? AGENT_TEXT_CLASS[r.agent!] : 'text-zinc-800',
          )}
        >
          {body ? <Markdown>{body}</Markdown> : null}
          {streaming ? (
            <span
              className="ml-0.5 inline-block h-3 w-[2px] translate-y-[2px] animate-pulse bg-zinc-500"
              aria-hidden
            />
          ) : null}
        </div>
      ) : null}
      <ToolCards results={r.toolResults} onSubmitAnswer={onSubmitAnswer} />
      {r.citations.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {r.citations.slice(0, 6).map((c, i) => (
            <CitationChip
              key={i}
              citation={c}
              onClick={(cit) => openSourcePdf(cit.sourceId, cit.page)}
            />
          ))}
          {r.citations.length > 6 ? (
            <span className="text-[10px] text-zinc-400">+{r.citations.length - 6} more</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolCards({
  results,
  onSubmitAnswer,
}: {
  results: ToolResult[];
  onSubmitAnswer?: (text: string) => void;
}) {
  return (
    <div className="space-y-3">
      {results.map((r, i) => {
        if (
          (r.kind === 'generate_problem' || r.kind === 'search_problem') &&
          r.problems.length > 0
        ) {
          return (
            <div key={i} className="space-y-3">
              {r.kind === 'search_problem' ? (
                <p className="text-[11px] font-medium text-zinc-500">
                  📂 저장된 문제 {r.problems.length}개
                </p>
              ) : null}
              {r.problems.map((p, idx) => (
                <ProblemCard
                  key={p.id ?? idx}
                  problem={p}
                  index={idx}
                  onSubmitAnswer={onSubmitAnswer}
                />
              ))}
            </div>
          );
        }
        if (r.kind === 'evaluate_answer') {
          return <EvaluationCard key={i} result={r.result} />;
        }
        if (r.kind === 'assess_level') {
          return <LevelCard key={i} result={r.result} />;
        }
        return null;
      })}
    </div>
  );
}
