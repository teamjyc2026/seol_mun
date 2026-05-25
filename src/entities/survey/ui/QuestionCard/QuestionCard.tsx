'use client';

import { useFormContext } from 'react-hook-form';
import { cn } from '@/shared/lib/cn';
import { partById } from '../../model/parts';
import type { Question } from '../../model/types';
import { QuestionCardContext, useQuestionCard } from './QuestionCardContext';

type RootProps = {
  question: Question;
  children: React.ReactNode;
  className?: string;
};

function Root({ question, children, className }: RootProps) {
  const theme = partById[question.partId].theme;
  return (
    <QuestionCardContext.Provider value={question}>
      <section
        data-question={question.id}
        className={cn(
          'group relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition',
          'hover:shadow-md focus-within:shadow-md',
          'focus-within:ring-2 focus-within:ring-offset-2',
          theme.ring,
          className,
        )}
      >
        {children}
      </section>
    </QuestionCardContext.Provider>
  );
}

function Header({ className }: { className?: string }) {
  const q = useQuestionCard();
  const part = partById[q.partId];
  return (
    <div className={cn('mb-3 flex items-center gap-2', className)}>
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
          part.theme.badge,
        )}
      >
        {q.id}
      </span>
      <span className="text-xs text-zinc-500">{part.title}</span>
      {q.optional ? (
        <span className="ml-auto text-[11px] font-medium text-zinc-400">
          선택
        </span>
      ) : null}
    </div>
  );
}

function Title({ className }: { className?: string }) {
  const q = useQuestionCard();
  return (
    <h3
      className={cn(
        'text-base font-semibold leading-relaxed text-zinc-900 sm:text-lg',
        className,
      )}
    >
      {q.title}
    </h3>
  );
}

function Helper({ className }: { className?: string }) {
  const q = useQuestionCard();
  if (!q.helper) return null;
  return (
    <p className={cn('mt-2 text-sm text-zinc-500', className)}>{q.helper}</p>
  );
}

function Field({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('mt-5', className)}>{children}</div>;
}

function Error({ className }: { className?: string }) {
  const q = useQuestionCard();
  const form = useFormContext();
  const error = form?.formState.errors?.answers as
    | Record<string, { message?: string } | undefined>
    | undefined;
  const msg = error?.[q.id]?.message;
  if (!msg) return null;
  return (
    <p
      role="alert"
      className={cn('mt-2 text-sm font-medium text-rose-600', className)}
    >
      {String(msg)}
    </p>
  );
}

export const QuestionCard = Object.assign(Root, {
  Header,
  Title,
  Helper,
  Field,
  Error,
});
