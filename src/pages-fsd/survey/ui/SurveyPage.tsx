'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  buildDefaultAnswers,
  parts,
  submissionSchema,
  type Part,
  type SubmissionForm,
  type SurveySubmission,
} from '@/entities/survey';
import { SurveyWizard, useWizardStep } from '@/widgets/survey-wizard';
import { useSubmitSurvey } from '@/features/submit-survey-response';
import { useDraftStore } from '@/shared/lib/draftStore';
import { PartBody } from './PartBody';

function partFieldNames(part: Part): string[] {
  if (part.id === 'CONSENT') {
    return [
      'consent.privacy_agreed',
      'consent.name',
      'consent.phone',
      'consent.affiliation',
      'consent.email',
    ];
  }
  return part.questionIds.map((id) => `answers.${id}`);
}

export function SurveyPage() {
  const router = useRouter();

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
      // gift is forced by the landing page; surveys reached without it
      // get redirected below. The cast satisfies the literal-union type.
      gift: 'oliveyoung' as SubmissionForm['gift'],
    }),
    [],
  );

  const form = useForm<SubmissionForm>({
    resolver: zodResolver(submissionSchema),
    defaultValues,
    mode: 'onChange',
  });

  const hydrated = useDraftStore((s) => s.hydrated);
  const storedGift = useDraftStore((s) => s.gift);
  const setAnswers = useDraftStore((s) => s.setAnswers);
  const setConsent = useDraftStore((s) => s.setConsent);
  const resetDraft = useDraftStore((s) => s.reset);

  // Hydrate form from persisted store once rehydration is done
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !hydrated) return;
    restored.current = true;
    const { answers, consent, gift } = useDraftStore.getState();
    if (answers && Object.keys(answers).length > 0) {
      form.setValue('answers', {
        ...defaultValues.answers,
        ...answers,
      } as SubmissionForm['answers']);
    }
    if (consent) {
      form.setValue('consent', {
        ...defaultValues.consent,
        ...consent,
      } as SubmissionForm['consent']);
    }
    if (gift) {
      form.setValue('gift', gift as SubmissionForm['gift']);
    } else {
      // No gift chosen → bounce back to landing
      toast.error('먼저 받으실 상품권을 선택해 주세요.');
      router.replace('/');
    }
  }, [hydrated, form, defaultValues, router]);

  // Keep form's gift in sync if user edits it on landing in another tab
  useEffect(() => {
    if (storedGift) form.setValue('gift', storedGift as SubmissionForm['gift']);
  }, [storedGift, form]);

  // Push form changes to store (debounced naturally by zustand batching)
  useEffect(() => {
    const sub = form.watch((value) => {
      if (value.answers) {
        setAnswers(value.answers as Parameters<typeof setAnswers>[0]);
      }
      if (value.consent) {
        setConsent(value.consent as Parameters<typeof setConsent>[0]);
      }
    });
    return () => sub.unsubscribe();
  }, [form, setAnswers, setConsent]);

  const step = useWizardStep(parts);

  const submit = useSubmitSurvey({
    onSuccess: () => {
      resetDraft();
      router.push('/survey/complete');
    },
    onError: (err) => {
      const e = err as { message?: string; status?: number } | undefined;
      if (e?.status === 403) {
        toast.error('설문이 마감되었습니다.');
        router.replace('/closed');
        return;
      }
      toast.error(e?.message ?? '제출에 실패했어요. 잠시 후 다시 시도해 주세요.');
    },
  });

  const handleNext = useCallback(async () => {
    const valid = await form.trigger(
      partFieldNames(step.part) as Parameters<typeof form.trigger>[0],
    );
    if (!valid) {
      toast.error('아직 입력하지 않은 항목이 있어요.');
      return;
    }
    if (step.isLast) {
      const ok = await form.trigger();
      if (!ok) {
        toast.error('이전 단계에 누락된 항목이 있어요.');
        return;
      }
      const values = form.getValues();
      submit.mutate(values as unknown as SurveySubmission);
    } else {
      step.next();
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [form, step, submit]);

  const handlePrev = useCallback(() => {
    step.prev();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  return (
    <FormProvider {...form}>
      <SurveyWizard
        parts={parts}
        index={step.index}
        isFirst={step.isFirst}
        isLast={step.isLast}
        total={step.total}
        onNext={handleNext}
        onPrev={handlePrev}
        isSubmitting={submit.isPending}
      >
        <SurveyWizard.Header />
        <SurveyWizard.Progress />
        <SurveyWizard.Step>
          <PartBody part={step.part} />
        </SurveyWizard.Step>
        <SurveyWizard.Footer>
          <SurveyWizard.PrevButton />
          <SurveyWizard.NextButton>
            {step.isLast ? (submit.isPending ? '제출 중…' : '제출하기') : '다음'}
          </SurveyWizard.NextButton>
        </SurveyWizard.Footer>
      </SurveyWizard>
    </FormProvider>
  );
}
