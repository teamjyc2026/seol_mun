'use client';

import { useState } from 'react';
import { Check, Loader2, Plus, RefreshCw, ScanText, Sparkles, X } from 'lucide-react';
import type { ProblemFigure } from '@/entities/problem';
import { cn } from '@/shared/lib/cn';
import { RichTextHelp, RichTextPreview } from '@/shared/ui/RichText';
import { FiguresEditor } from './FiguresEditor';
import { ProblemFields, emptySubProblem, type WbSubProblem } from './ProblemFields';

export type { WbSubProblem } from './ProblemFields';

/**
 * 한 박스 = 공유 지문/그림 + 문제 1..N.
 * 대표 문제의 필드는 평면으로 두고(기존 호환), 추가 문제는 extra[]에 둔다.
 */
export type WorkbenchProblemValue = WbSubProblem & {
  passage: string;
  /** 지문 해석 (영어 지문의 한국어 해석 등) — 해설과 별개 필드. */
  passage_translation: string;
  /** 그림/도표 — 보조 뷰어의 "그림 가져오기" 또는 직접 업로드로 채운다(지문 공유). */
  figures: ProblemFigure[];
  /** 같은 지문을 공유하는 추가 문제들. 있으면 passage set으로 저장. */
  extra: WbSubProblem[];
};

export function emptyProblemValue(): WorkbenchProblemValue {
  return {
    ...emptySubProblem(),
    passage: '',
    passage_translation: '',
    figures: [],
    extra: [],
  };
}

/** WorkbenchProblemValue ↔ 대표 문제(WbSubProblem) 추출/병합. */
function primaryOf(v: WorkbenchProblemValue): WbSubProblem {
  return {
    problem_type: v.problem_type,
    difficulty: v.difficulty,
    category: v.category,
    topic: v.topic,
    question: v.question,
    choices: v.choices,
    answer: v.answer,
    explanation: v.explanation,
    coreContent: v.coreContent,
    choiceExplanation: v.choiceExplanation,
  };
}

/** 워크벤치 전용 컴팩트 문제 폼 — 과목·출처는 소스(상단)에서 상속된다. */
export function WorkbenchProblemForm({
  subject,
  value,
  onChange,
  uploadFigure,
  isSet: isSetProp,
  activeChild = 0,
  onActiveChild,
  onRescanChild,
  childRefCounts,
  grabbing,
  onTranslatePassage,
}: {
  subject: string;
  value: WorkbenchProblemValue;
  onChange: (next: WorkbenchProblemValue) => void;
  /** 파일을 Storage에 올리고 public URL을 돌려준다 (실패 시 null). */
  uploadFigure: (file: File) => Promise<string | null>;
  /** 세트(문제 여러 개) — 블록별 헤더/풀이 받기 버튼을 보인다. */
  isSet?: boolean;
  /** 지금 풀이(정답·해설)를 받는 자식 인덱스 (0=대표, i+1=extra[i]). */
  activeChild?: number;
  /** 블록의 "이 문제 풀이 받기" 클릭 시 활성 자식 변경. */
  onActiveChild?: (i: number) => void;
  /** 블록의 "해설 다시 스캔" 클릭 — 그 자식의 연결된 해설 영역을 재OCR. */
  onRescanChild?: (i: number) => void;
  /** 자식별 연결된 해설 영역 수 (0이면 다시 스캔 버튼 숨김). */
  childRefCounts?: number[];
  /** 스캔 진행 중(버튼 비활성). */
  grabbing?: boolean;
  /** 지문으로 한국어 해석 생성 (해설지에 해석이 없을 때). */
  onTranslatePassage?: (passage: string) => Promise<string | null>;
}) {
  const isSet = isSetProp ?? value.extra.length > 0;
  const [translating, setTranslating] = useState(false);
  async function makeTranslation() {
    if (!onTranslatePassage || translating || !value.passage.trim()) return;
    setTranslating(true);
    try {
      const t = await onTranslatePassage(value.passage);
      if (t) onChange({ ...value, passage_translation: t });
    } finally {
      setTranslating(false);
    }
  }
  const updExtra = (i: number, sub: WbSubProblem) =>
    onChange({ ...value, extra: value.extra.map((e, idx) => (idx === i ? sub : e)) });
  const removeExtra = (i: number) =>
    onChange({ ...value, extra: value.extra.filter((_, idx) => idx !== i) });
  const addExtra = () => onChange({ ...value, extra: [...value.extra, emptySubProblem()] });

  /** 블록 헤더의 "이 문제 풀이 받기" 토글 — 보조 뷰어 grab 대상(activeChild) 지정. */
  const answerToggle = (idx: number) =>
    onActiveChild && (
      <button
        type="button"
        onClick={() => onActiveChild(idx)}
        title="오른쪽 보조 뷰어(해설 PDF)에서 영역을 잡으면 그 정답·해설이 이 문제로 들어가요. (스캔은 보조 뷰어에서)"
        className={cn(
          'inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium transition',
          activeChild === idx
            ? 'border-emerald-600 bg-emerald-600 text-white'
            : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50',
        )}
      >
        {activeChild === idx ? <Check className="h-3 w-3" /> : <ScanText className="h-3 w-3" />}
        {activeChild === idx ? '선택됨' : '이 문제 선택'}
      </button>
    );

  /** 그 자식에 연결된 해설이 있을 때만 보이는 "해설 다시 스캔" 버튼. */
  const rescanButton = (idx: number) =>
    onRescanChild && (childRefCounts?.[idx] ?? 0) > 0 ? (
      <button
        type="button"
        onClick={() => onRescanChild(idx)}
        disabled={grabbing}
        title="연결된 해설 영역을 다시 읽어 이 문제의 정답·해설을 갱신"
        className="inline-flex h-6 items-center gap-1 rounded-md border border-zinc-300 bg-white px-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
      >
        <RefreshCw className={cn('h-3 w-3', grabbing && 'animate-spin')} /> 해설 다시 스캔
      </button>
    ) : null;

  return (
    <div className="space-y-4">
      <RichTextHelp />

      {/* 공유 지문/지문해석/그림 */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-700">
          지문 (선택{isSet ? ' · 세트 공유' : ''})
        </label>
        <textarea
          value={value.passage}
          onChange={(e) => onChange({ ...value, passage: e.target.value })}
          rows={5}
          placeholder="지문/제시문 — 없으면 비워두세요"
          className="block w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none"
        />
        <RichTextPreview value={value.passage} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-zinc-700">지문 해석 (선택)</label>
          {onTranslatePassage && (
            <button
              type="button"
              onClick={makeTranslation}
              disabled={translating || !value.passage.trim()}
              title="해설지에 해석이 없을 때 — 위 지문으로 한국어 해석을 자동 생성"
              className="inline-flex h-6 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-40"
            >
              {translating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              지문으로 해석 생성
            </button>
          )}
        </div>
        <textarea
          value={value.passage_translation}
          onChange={(e) => onChange({ ...value, passage_translation: e.target.value })}
          rows={4}
          placeholder="지문의 한국어 해석 — 해설지에서 가져오거나 직접 기입 / 위 버튼으로 생성"
          className="block w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none"
        />
      </div>

      <FiguresEditor
        figures={value.figures}
        onChange={(figures) => onChange({ ...value, figures })}
        uploadFigure={uploadFigure}
        hint="그림은 보통 본문에 들어가요. 보조 뷰어 “그림” 모드로 영역을 가져오거나 직접 올리세요. 도표는 본문·발문에 마크다운 표로."
      />

      {/* 대표 문제 (문제 1) */}
      <div
        className={cn(
          'space-y-2 rounded-lg border p-3',
          isSet && activeChild === 0
            ? 'border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-200'
            : 'border-zinc-100 bg-zinc-50/40',
        )}
      >
        {isSet && (
          <div className="flex flex-wrap items-center justify-between gap-1">
            <p className="text-xs font-bold text-zinc-700">문제 1</p>
            <div className="flex flex-wrap items-center gap-1">
              {answerToggle(0)}
              {rescanButton(0)}
            </div>
          </div>
        )}
        <ProblemFields
          subject={subject}
          value={primaryOf(value)}
          onChange={(sub) => onChange({ ...value, ...sub })}
        />
      </div>

      {/* 같은 지문 추가 문제 (세트) */}
      {value.extra.map((sub, i) => (
        <div
          key={i}
          className={cn(
            'space-y-2 rounded-lg border p-3',
            activeChild === i + 1
              ? 'border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-200'
              : 'border-indigo-100 bg-indigo-50/40',
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-1">
            <p className="text-xs font-bold text-indigo-700">문제 {i + 2}</p>
            <div className="flex flex-wrap items-center gap-1">
              {answerToggle(i + 1)}
              {rescanButton(i + 1)}
              <button
                type="button"
                onClick={() => removeExtra(i)}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-zinc-200 bg-white px-1.5 text-[11px] text-zinc-500 hover:bg-rose-50 hover:text-rose-600"
              >
                <X className="h-3 w-3" /> 삭제
              </button>
            </div>
          </div>
          <ProblemFields subject={subject} value={sub} onChange={(next) => updExtra(i, next)} />
        </div>
      ))}

      <button
        type="button"
        onClick={addExtra}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-indigo-300 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
      >
        <Plus className="h-3.5 w-3.5" /> 같은 지문 문제 추가
      </button>
    </div>
  );
}
