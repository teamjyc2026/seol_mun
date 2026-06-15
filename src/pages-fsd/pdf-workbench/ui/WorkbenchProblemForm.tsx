'use client';

import { Plus, X } from 'lucide-react';
import type { ProblemFigure } from '@/entities/problem';
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
  };
}

/** 워크벤치 전용 컴팩트 문제 폼 — 과목·출처는 소스(상단)에서 상속된다. */
export function WorkbenchProblemForm({
  subject,
  value,
  onChange,
  uploadFigure,
}: {
  subject: string;
  value: WorkbenchProblemValue;
  onChange: (next: WorkbenchProblemValue) => void;
  /** 파일을 Storage에 올리고 public URL을 돌려준다 (실패 시 null). */
  uploadFigure: (file: File) => Promise<string | null>;
}) {
  const isSet = value.extra.length > 0;
  const updExtra = (i: number, sub: WbSubProblem) =>
    onChange({ ...value, extra: value.extra.map((e, idx) => (idx === i ? sub : e)) });
  const removeExtra = (i: number) =>
    onChange({ ...value, extra: value.extra.filter((_, idx) => idx !== i) });
  const addExtra = () => onChange({ ...value, extra: [...value.extra, emptySubProblem()] });

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
        <label className="text-xs font-medium text-zinc-700">지문 해석 (선택)</label>
        <textarea
          value={value.passage_translation}
          onChange={(e) => onChange({ ...value, passage_translation: e.target.value })}
          rows={4}
          placeholder="지문의 한국어 해석 — 해설지에서 가져오거나 직접 기입"
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
      <div className="space-y-2 rounded-lg border border-zinc-100 bg-zinc-50/40 p-3">
        {isSet && <p className="text-xs font-bold text-zinc-700">문제 1</p>}
        <ProblemFields
          subject={subject}
          value={primaryOf(value)}
          onChange={(sub) => onChange({ ...value, ...sub })}
        />
      </div>

      {/* 같은 지문 추가 문제 (세트) */}
      {value.extra.map((sub, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-indigo-700">문제 {i + 2}</p>
            <button
              type="button"
              onClick={() => removeExtra(i)}
              className="inline-flex h-6 items-center gap-1 rounded-md border border-zinc-200 bg-white px-1.5 text-[11px] text-zinc-500 hover:bg-rose-50 hover:text-rose-600"
            >
              <X className="h-3 w-3" /> 문제 삭제
            </button>
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
