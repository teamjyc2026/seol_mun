'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, Gift } from 'lucide-react';
import { api } from '@/shared/api/axios';
import { cn } from '@/shared/lib/cn';
import {
  buildDefaultAnswers,
  parts,
  submissionSchema,
  type GiftChoice,
  type Part,
  type SubmissionForm,
  type SurveySubmission,
} from '@/entities/survey';
import { ConsentStep } from '@/features/consent-agreement';
import { PartBody } from '@/pages-fsd/survey/ui/PartBody';

const giftOptions: { value: GiftChoice; title: string; sub: string }[] = [
  { value: 'oliveyoung', title: '올리브영 5,000원', sub: '뷰티·생활용품' },
  { value: 'cu', title: '편의점 5,000원', sub: 'CU / GS25 / 세븐일레븐' },
];

export function AdminNewPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [gift, setGift] = useState<GiftChoice>('oliveyoung');

  const defaultValues = useMemo<SubmissionForm>(
    () => ({
      answers: buildDefaultAnswers() as SubmissionForm['answers'],
      consent: {
        privacy_agreed: false as unknown as true,
        name: '',
        phone: '',
        affiliation: '',
        email: '',
      } as SubmissionForm['consent'],
      gift: 'oliveyoung' as SubmissionForm['gift'],
    }),
    [],
  );

  const form = useForm<SubmissionForm>({
    resolver: zodResolver(submissionSchema),
    defaultValues,
    mode: 'onChange',
  });

  const mutation = useMutation({
    mutationFn: (payload: SurveySubmission) =>
      api.post<{ id: string }>('/admin/responses', payload).then((r) => r.data),
    onSuccess: () => {
      toast.success('응답을 추가했어요.');
      startTransition(() => router.push('/admin/tutor'));
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : '저장에 실패했어요.';
      toast.error(msg);
    },
  });

  async function onSave() {
    form.setValue('gift', gift as SubmissionForm['gift']);
    const ok = await form.trigger();
    if (!ok) {
      toast.error('아직 입력하지 않은 항목이 있어요.');
      return;
    }
    const values = form.getValues();
    mutation.mutate(values as unknown as SurveySubmission);
  }

  const visibleParts = parts.filter((p) => p.id !== 'CONSENT') as Part[];
  const consentPart = parts.find((p) => p.id === 'CONSENT')!;

  return (
    <FormProvider {...form}>
      <main className="min-h-svh bg-zinc-50">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <header className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                href="/admin/tutor"
                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-zinc-600 transition hover:bg-zinc-100"
              >
                <ArrowLeft className="h-4 w-4" /> 대시보드
              </Link>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900">
              응답 수동 추가
            </h1>
          </header>

          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            오프라인 종이 설문이나 사전 인터뷰 결과를 직접 입력할 때 사용하세요.
            여기서 추가된 응답은 공개 정원 한도와 별개로 저장됩니다.
          </p>

          <section className="mb-6 space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
              <Gift className="h-4 w-4 text-rose-500" /> 상품권
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {giftOptions.map((g) => {
                const active = gift === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGift(g.value)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border bg-white p-3 text-left transition',
                      'hover:border-zinc-300 hover:bg-zinc-50',
                      active
                        ? 'border-transparent shadow-sm ring-2 ring-zinc-900'
                        : 'border-zinc-200',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-5 w-5 place-items-center rounded-full border-2 transition',
                        active ? 'border-transparent bg-zinc-900' : 'border-zinc-300',
                      )}
                      aria-hidden
                    >
                      {active ? <Check className="h-3 w-3 text-white" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-zinc-900">
                        {g.title}
                      </span>
                      <span className="block text-xs text-zinc-500">{g.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="space-y-8">
            {visibleParts.map((part) => (
              <section
                key={part.id}
                data-part={part.id}
                className="space-y-3"
              >
                <h2 className={cn('text-sm font-bold', part.theme.accentText)}>
                  {part.title}
                </h2>
                <div className="space-y-3">
                  <PartBody part={part} />
                </div>
              </section>
            ))}

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-zinc-700">
                {consentPart.title}
              </h2>
              <ConsentStep />
            </section>
          </div>

          <div className="sticky bottom-4 mt-8 flex items-center justify-end gap-2">
            <Link
              href="/admin/tutor"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
            >
              취소
            </Link>
            <button
              type="button"
              onClick={onSave}
              disabled={mutation.isPending || isPending}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white shadow-md transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {mutation.isPending ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </main>
    </FormProvider>
  );
}
