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
import { PartBody } from './PartBody';

const DRAFT_KEY = 'seolmun:draft-v2';

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
    }),
    [],
  );

  const form = useForm<SubmissionForm>({
    resolver: zodResolver(submissionSchema),
    defaultValues,
    mode: 'onChange',
  });

  // Restore from localStorage on mount
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SubmissionForm>;
        if (parsed.answers) form.setValue('answers', { ...defaultValues.answers, ...parsed.answers });
        if (parsed.consent)
          form.setValue('consent', { ...defaultValues.consent, ...parsed.consent });
      }
    } catch {
      // ignore corrupted draft
    }
    restored.current = true;
  }, [form, defaultValues]);

  // Persist to localStorage (debounced via subscription)
  useEffect(() => {
    const sub = form.watch((value) => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
      } catch {
        // quota / private mode — ignore
      }
    });
    return () => sub.unsubscribe();
  }, [form]);

  const step = useWizardStep(parts);

  const submit = useSubmitSurvey({
    onSuccess: (id) => {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {}
      }
      router.push(`/survey/complete?id=${id}`);
    },
    onError: (err) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message?: string }).message
          : '제출에 실패했어요.';
      toast.error(msg ?? '제출에 실패했어요. 잠시 후 다시 시도해 주세요.');
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
