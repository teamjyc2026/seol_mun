'use client';

import { useRef, useState } from 'react';
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
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('교과서');
  const { subject, setSubject } = useSubject();
  const [grade, setGrade] = useState<Grade | ''>('');
  const [publisher, setPublisher] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [edition, setEdition] = useState('');
  const [isbn, setIsbn] = useState('');
  const [unitsRaw, setUnitsRaw] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('PDF 파일을 선택해 주세요.');
      return uploadSource({
        file,
        title: title || file.name.replace(/\.pdf$/i, ''),
        source_type: sourceType,
        subjects: [subject],
        grade: grade || null,
        publisher: publisher || null,
        year: year ? Number(year) : null,
        description: description || null,
        author: author || null,
        edition: edition || null,
        isbn: isbn || null,
        units: splitCommas(unitsRaw),
        tags: splitCommas(tagsRaw),
      });
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
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !title) setTitle(f.name.replace(/\.pdf$/i, ''));
            }}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-white hover:file:bg-zinc-800"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="src-title">제목 (필수)</Label>
          <Input
            id="src-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예) 한국사 교과서 미래엔 2024"
          />
        </div>

        <div className="space-y-1.5">
          <Label>과목 (필수)</Label>
          <div className="flex flex-wrap gap-1.5">
            {SUBJECTS.map((s) => {
              const active = subject === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubject(s)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                    active
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                  )}
                >
                  {s}
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
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as SourceType)}
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
              value={grade}
              onChange={(e) => setGrade(e.target.value as Grade | '')}
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
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              placeholder="예) 미래엔"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="src-year">출판년도</Label>
            <Input
              id="src-year"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2024"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="src-author">저자</Label>
            <Input
              id="src-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="홍길동"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="src-edition">판본</Label>
            <Input
              id="src-edition"
              value={edition}
              onChange={(e) => setEdition(e.target.value)}
              placeholder="2024 개정판"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="src-isbn">ISBN</Label>
          <Input
            id="src-isbn"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            placeholder="978-89-..."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="src-units">책 단원/키워드 (쉼표 구분)</Label>
          <Input
            id="src-units"
            value={unitsRaw}
            onChange={(e) => setUnitsRaw(e.target.value)}
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
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="예) 내신, 수능대비, 중요"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="src-desc">메모</Label>
          <textarea
            id="src-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="(선택) 자료 출처/사용 맥락 등"
            className="block w-full resize-y rounded-md border border-zinc-200 px-2 py-1.5 text-sm outline-none"
          />
        </div>

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
            disabled={!file || mutation.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white shadow-md transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {mutation.isPending ? '업로드·인덱싱 중…' : '업로드'}
          </button>
        </div>
      </div>
    </div>
  );
}
