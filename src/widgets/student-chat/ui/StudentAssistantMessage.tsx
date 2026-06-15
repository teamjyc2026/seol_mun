'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentReply, ToolResult } from '@/shared/agent/types';
import { parseQuickReplies, stripTrailerTail } from '@/shared/agent/quickReplies';
import { parseSolveStage, stripStageMarkers } from '@/shared/agent/solveStage';
import { openSourcePdf } from '@/features/open-source-pdf';
import {
  CitationChip,
  EvaluationCard,
  LevelCard,
  ProblemCard,
} from '@/widgets/agent-chat';
import { splitSegments } from '../lib/splitSegments';
import { MascotAvatar } from './MascotAvatar';
import { QuickReplies } from './QuickReplies';
import { StudentBubble } from './StudentBubble';
import { TypingDots } from './TypingDots';

/**
 * 설문이의 한 턴 — 텍스트를 짧은 버블 여러 개로 쪼개 reveal 큐로 하나씩
 * 등장시키고, 다 나오면 문제/채점 카드와 퀵리플라이 버튼을 보여준다.
 */
export function StudentAssistantMessage({
  reply,
  streaming,
  isLast,
  sending,
  onQuickReply,
  onSubmitAnswer,
}: {
  reply: AgentReply;
  streaming?: boolean;
  isLast: boolean;
  sending: boolean;
  onQuickReply: (label: string) => void;
  onSubmitAnswer: (text: string) => void;
}) {
  // 스트리밍 중엔 꼬리의 [[선택지]] 트레일러와 {{단계}} 마커를 숨기고,
  // 완료본은 안전망 파싱.
  const display = streaming
    ? stripStageMarkers(stripTrailerTail(reply.text))
    : parseQuickReplies(parseSolveStage(reply.text).text).text;
  const segments = useMemo(() => splitSegments(display), [display]);
  // 스트리밍 중 마지막 세그먼트는 아직 자라는 중 — 완성된 것만 공개 대상.
  const completed = streaming ? Math.max(segments.length - 1, 0) : segments.length;

  // 리로드된 메시지(스트리밍 아님)는 즉시 전체 표시, 새 메시지는 0부터 큐.
  const [revealed, setRevealed] = useState(() =>
    streaming ? 0 : Number.MAX_SAFE_INTEGER,
  );
  const animate = revealed !== Number.MAX_SAFE_INTEGER;

  useEffect(() => {
    if (revealed >= completed) return;
    const t = setTimeout(() => setRevealed((n) => n + 1), revealed === 0 ? 50 : 450);
    return () => clearTimeout(t);
  }, [revealed, completed]);

  const pending = !!streaming || revealed < completed;
  const shown = segments.slice(0, Math.min(revealed, completed));
  const choices = reply.choices ?? [];

  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (isLast && animate) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [isLast, animate, shown.length, pending]);

  return (
    <div className="flex gap-2">
      <MascotAvatar size="sm" className="mt-1" />
      <div className="min-w-0 flex-1 space-y-2">
        {shown.map((seg, i) => (
          <StudentBubble key={i} role="assistant" text={seg} animate={animate} />
        ))}
        {pending ? <TypingDots /> : null}
        {!pending ? (
          <>
            <ToolCards results={reply.toolResults} onSubmitAnswer={onSubmitAnswer} />
            {reply.citations.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {reply.citations.slice(0, 6).map((c, i) => (
                  <CitationChip
                    key={i}
                    citation={c}
                    onClick={(cit) => openSourcePdf(cit.sourceId, cit.page)}
                  />
                ))}
              </div>
            ) : null}
            {isLast && !sending && choices.length > 0 ? (
              <QuickReplies choices={choices} onPick={onQuickReply} />
            ) : null}
          </>
        ) : null}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function ToolCards({
  results,
  onSubmitAnswer,
}: {
  results: ToolResult[];
  onSubmitAnswer: (text: string) => void;
}) {
  if (results.length === 0) return null;
  return (
    <div className="space-y-3">
      {results.map((r, i) => {
        if (
          (r.kind === 'generate_problem' || r.kind === 'search_problem') &&
          r.problems.length > 0
        ) {
          return (
            <div key={i} className="space-y-3">
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
