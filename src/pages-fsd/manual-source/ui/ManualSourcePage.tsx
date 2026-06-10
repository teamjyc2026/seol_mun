'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PencilLine } from 'lucide-react';
import type { School } from '@/entities/school';
import { SUBJECTS, DEFAULT_SUBJECT } from '@/shared/config/subjects';
import { cn } from '@/shared/lib/cn';
import { ImageCropOcr } from '@/shared/ui/ImageCropOcr';

const SOURCE_TYPES = ['교과서', '문제집', '기출', '요약본', '강의자료', '기타'];
const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];

export function ManualSourcePage({ schools }: { schools: School[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<string>(DEFAULT_SUBJECT);
  const [grade, setGrade] = useState('');
  const [sourceType, setSourceType] = useState('교과서');
  const [publisher, setPublisher] = useState('');
  const [units, setUnits] = useState('');
  const [schoolId, setSchoolId] = useState<string | null>(schools[0]?.id ?? null);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (!title.trim() || content.trim().length < 40) {
      toast.error('제목과 본문(40자 이상)을 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/agent/sources/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          subject,
          grade: grade || undefined,
          source_type: sourceType,
          publisher: publisher.trim() || undefined,
          units: units
            .split(',')
            .map((u) => u.trim())
            .filter(Boolean),
          schoolId,
          content,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? '등록 실패');
      }
      const data = (await res.json()) as { chunks: number };
      toast.success(`교재를 등록했어요 (청크 ${data.chunks}개, 임베딩 완료).`);
      router.push('/admin/agent/sources');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '등록 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center gap-2">
        <PencilLine className="h-5 w-5 text-zinc-700" />
        <h1 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
          교재 직접 기입
        </h1>
        <p className="ml-2 text-xs text-zinc-500">
          PDF 없이 본문 텍스트를 직접 입력(또는 이미지에서 인식)해 등록합니다.
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700">제목 (필수)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예) 천재 영어 Lesson 3 본문 정리"
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700">과목</label>
          <div className="flex flex-wrap gap-1.5">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSubject(s)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                  subject === s
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700">학년</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
            >
              <option value="">선택 안 함</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700">자료 유형</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700">출판사</label>
            <input
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              placeholder="예) 천재교육"
              className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700">학교 배정</label>
            <select
              value={schoolId ?? ''}
              onChange={(e) => setSchoolId(e.target.value || null)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
            >
              <option value="">배정 안 함</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700">
            단원 키워드 (쉼표 구분)
          </label>
          <input
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            placeholder="예) Lesson 3, Journey into Another Culture"
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700">
            본문 텍스트 (필수, 40자 이상) — 등록 시 바로 청크·임베딩됩니다
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            placeholder="본문을 붙여넣거나, 아래 이미지 인식으로 채우세요."
            className="block w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none"
          />
          <ImageCropOcr
            label="본문을 이미지에서 글자 인식 (붙여넣기 · 크롭)"
            onText={(t) => setContent((prev) => (prev ? `${prev}\n${t}` : t))}
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? '등록 중… (청크·임베딩)' : '교재 등록'}
        </button>
      </div>
    </main>
  );
}
