'use client';

import type { AgentReply, ProblemDraft, ToolResult } from '@/shared/agent/types';
import { AGENT_LABELS, AGENT_TEXT_CLASS } from '@/shared/agent/agents/styles';
import { Markdown } from '@/shared/ui/Markdown/Markdown';
import { RichText } from '@/shared/ui/RichText';
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

// 연속된 같은 지문 세트(passage_set_id) 문제들을 묶는다 — 지문 1회만 표시.
function groupBySet(
  problems: ProblemDraft[],
): { setId: string | null; items: { p: ProblemDraft; idx: number }[] }[] {
  const groups: { setId: string | null; items: { p: ProblemDraft; idx: number }[] }[] = [];
  problems.forEach((p, idx) => {
    const sid = p.passage_set_id ?? null;
    const last = groups[groups.length - 1];
    if (sid && last && last.setId === sid) last.items.push({ p, idx });
    else groups.push({ setId: sid, items: [{ p, idx }] });
  });
  return groups;
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
              {groupBySet(r.problems).map((g, gi) => {
                // 세트(2문제 이상 + 지문 있음)면 지문을 그룹 상단에 1회만.
                const groupPassage =
                  g.setId && g.items.length > 1
                    ? g.items.find((it) => it.p.passage)?.p.passage
                    : null;
                return (
                  <div key={g.setId ?? `solo-${gi}`} className="space-y-3">
                    {groupPassage ? (
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[14px] leading-relaxed text-zinc-800">
                        <RichText text={groupPassage} />
                      </div>
                    ) : null}
                    {g.items.map(({ p, idx }) => (
                      <ProblemCard
                        key={p.id ?? idx}
                        problem={p}
                        index={idx}
                        onSubmitAnswer={onSubmitAnswer}
                        hidePassage={!!groupPassage}
                      />
                    ))}
                  </div>
                );
              })}
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
