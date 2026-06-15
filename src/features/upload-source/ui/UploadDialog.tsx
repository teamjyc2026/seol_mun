'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SOURCE_TYPES, GRADES, type SourceType, type Grade } from '@/entities/source';
import { SUBJECTS } from '@/shared/config/subjects';
import { cn } from '@/shared/lib/cn';
import { useSubject } from '@/shared/store/subject';
import { useMergeState } from '@/shared/lib/mergeReducer';
import { uploadSource } from '../api/uploadSource';

function splitCommas(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function UploadDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const { subject, setSubject } = useSubject();
  const [f, set] = useMergeState({
    file: null as File | null,
    title: '',
    sourceType: '교과서' as SourceType,
    grade: '' as Grade | '',
    publisher: '',
    year: '',
    description: '',
    author: '',
    edition: '',
    isbn: '',
    unitsRaw: '',
    tagsRaw: '',
    progress: 0,
    phase: 'upload' as 'upload' | 'index',
  });

  const mutation = useMutation({
    onMutate: () => set({ progress: 0, phase: 'upload' }),
    mutationFn: () => {
      if (!f.file) throw new Error('PDF 파일을 선택해 주세요.');
      const file = f.file;
      return uploadSource(
        {
          file,
          title: f.title || file.name.replace(/\.pdf$/i, ''),
          source_type: f.sourceType,
          subjects: [subject],
          grade: f.grade || null,
          publisher: f.publisher || null,
          year: f.year ? Number(f.year) : null,
          description: f.description || null,
          author: f.author || null,
          edition: f.edition || null,
          isbn: f.isbn || null,
          units: splitCommas(f.unitsRaw),
          tags: splitCommas(f.tagsRaw),
        },
        (pct) => {
          // bytes done → server now chunks + embeds (no byte stream for that)
          set(pct >= 100 ? { progress: pct, phase: 'index' } : { progress: pct });
        },
      );
    },
    onSuccess: () => {
      toast.success('업로드 + 인덱싱 완료');
      router.refresh();
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : '업로드에 실패했어요.';
      toast.error(msg);
    },
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-900/40 p-4 overflow-y-auto">
      <div className="my-8 w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">소스 PDF 업로드</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="src-file">파일 (PDF, 최대 50MB)</Label>
          <input
            ref={fileRef}
            id="src-file"
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              set(file && !f.title ? { file, title: file.name.replace(/\.pdf$/i, '') } : { file });
            }}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-white hover:file:bg-zinc-800"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="src-title">제목 (필수)</Label>
          <Input
            id="src-title"
            value={f.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="예) 한국사 교과서 미래엔 2024"
          />
        </div>

        <div className="space-y-1.5">
          <Label>과목 (필수)</Label>
          <div className="flex flex-wrap gap-1.5">
            {SUBJECTS.map((sub) => {
              const active = subject === sub;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSubject(sub)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                    active
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                  )}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="src-type">유형 (필수)</Label>
            <select
              id="src-type"
              value={f.sourceType}
              onChange={(e) => set({ sourceType: e.target.value as SourceType })}
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
            <Label htmlFor="src-grade">학년</Label>
            <select
              id="src-grade"
              value={f.grade}
              onChange={(e) => set({ grade: e.target.value as Grade | '' })}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
            >
              <option value="">(없음)</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="src-publisher">출판사</Label>
            <Input
              id="src-publisher"
              value={f.publisher}
              onChange={(e) => set({ publisher: e.target.value })}
              placeholder="예) 미래엔"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="src-year">출판년도</Label>
            <Input
              id="src-year"
              type="number"
              value={f.year}
              onChange={(e) => set({ year: e.target.value })}
              placeholder="2024"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="src-author">저자</Label>
            <Input
              id="src-author"
              value={f.author}
              onChange={(e) => set({ author: e.target.value })}
              placeholder="홍길동"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="src-edition">판본</Label>
            <Input
              id="src-edition"
              value={f.edition}
              onChange={(e) => set({ edition: e.target.value })}
              placeholder="2024 개정판"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="src-isbn">ISBN</Label>
          <Input
            id="src-isbn"
            value={f.isbn}
            onChange={(e) => set({ isbn: e.target.value })}
            placeholder="978-89-..."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="src-units">책 단원/키워드 (쉼표 구분)</Label>
          <Input
            id="src-units"
            value={f.unitsRaw}
            onChange={(e) => set({ unitsRaw: e.target.value })}
            placeholder="예) 임진왜란, 병자호란, 조선후기"
          />
          <p className="text-[11px] text-zinc-500">
            기본은 PDF 목차에서 자동 추출 — 목차가 없거나 부족할 때 보조 키워드로
            쓰여 검색 품질이 좋아져요. (선택)
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="src-tags">태그 (쉼표 구분)</Label>
          <Input
            id="src-tags"
            value={f.tagsRaw}
            onChange={(e) => set({ tagsRaw: e.target.value })}
            placeholder="예) 내신, 수능대비, 중요"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="src-desc">메모</Label>
          <textarea
            id="src-desc"
            value={f.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={2}
            placeholder="(선택) 자료 출처/사용 맥락 등"
            className="block w-full resize-y rounded-md border border-zinc-200 px-2 py-1.5 text-sm outline-none"
          />
        </div>

        {mutation.isPending ? (
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500">
              <span>{f.phase === 'upload' ? '파일 전송 중…' : '인덱싱(임베딩) 중…'}</span>
              <span>{f.phase === 'upload' ? `${f.progress}%` : '거의 다 됐어요'}</span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              {f.phase === 'upload' ? (
                <div
                  className="h-full rounded-full bg-zinc-900 transition-[width] duration-150"
                  style={{ width: `${f.progress}%` }}
                />
              ) : (
                <span className="progress-indeterminate" />
              )}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!f.file || mutation.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white shadow-md transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {mutation.isPending
              ? f.phase === 'upload'
                ? `전송 ${f.progress}%`
                : '인덱싱 중…'
              : '업로드'}
          </button>
        </div>
      </div>
    </div>
  );
}
