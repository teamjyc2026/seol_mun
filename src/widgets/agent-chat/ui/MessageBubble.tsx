'use client';

import type { AgentReply, ToolResult } from '@/shared/agent/types';
import { cn } from '@/shared/lib/cn';
import { ProblemCard } from './ProblemCard';
import { EvaluationCard } from './EvaluationCard';
import { LevelCard } from './LevelCard';
import { CitationChip } from './CitationChip';

export type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; reply: AgentReply; streaming?: boolean };

export function MessageBubble({ msg }: { msg: ChatMessage }) {
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
  return (
    <div className="space-y-3">
      {r.text || streaming ? (
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2.5 text-sm leading-relaxed text-zinc-800 whitespace-pre-wrap">
          {r.text}
          {streaming ? (
            <span
              className="ml-0.5 inline-block h-3 w-[2px] translate-y-[2px] animate-pulse bg-zinc-500"
              aria-hidden
            />
          ) : null}
        </div>
      ) : null}
      <ToolCards results={r.toolResults} />
      {r.citations.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {r.citations.slice(0, 6).map((c, i) => (
            <CitationChip key={i} citation={c} />
          ))}
          {r.citations.length > 6 ? (
            <span className="text-[10px] text-zinc-400">+{r.citations.length - 6} more</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolCards({ results }: { results: ToolResult[] }) {
  return (
    <div className="space-y-3">
      {results.map((r, i) => {
        if (r.kind === 'generate_problem' && r.problems.length > 0) {
          return (
            <div key={i} className="space-y-3">
              {r.problems.map((p, idx) => (
                <ProblemCard key={p.id ?? idx} problem={p} index={idx} />
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
