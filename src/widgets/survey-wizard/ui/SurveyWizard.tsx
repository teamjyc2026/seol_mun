'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/shared/lib/cn';
import type { Part } from '@/entities/survey';
import { WizardContext, useWizard } from './WizardContext';

type RootProps = {
  parts: Part[];
  index: number;
  isFirst: boolean;
  isLast: boolean;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  isSubmitting?: boolean;
  children: React.ReactNode;
};

function Root({ children, parts, ...rest }: RootProps) {
  const part = parts[rest.index];
  const ctx = { parts, part, ...rest };
  return (
    <WizardContext.Provider value={ctx}>
      <div
        data-part={part.id}
        className={cn(
          'min-h-svh bg-gradient-to-b',
          part.theme.softGradient,
        )}
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </div>
      </div>
    </WizardContext.Provider>
  );
}

function Header() {
  const { part } = useWizard();
  return (
    <header className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2.5 py-0.5',
            part.theme.badge,
          )}
        >
          STEP {part.index}
        </span>
        {part.subtitle ? <span>{part.subtitle}</span> : null}
      </div>
      <h1 className={cn('text-2xl font-bold tracking-tight sm:text-3xl', part.theme.accentText)}>
        {part.title}
      </h1>
      {part.description ? (
        <p className="text-sm text-zinc-600 sm:text-base">{part.description}</p>
      ) : null}
    </header>
  );
}

function Progress() {
  const { parts, index, part } = useWizard();
  const percent = Math.round(((index + 1) / parts.length) * 100);
  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-white/70 shadow-inner"
      >
        <div
          className={cn('h-full rounded-full transition-all duration-500', part.theme.accentBg)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>
          {index + 1} / {parts.length} 단계
        </span>
        <span>{percent}%</span>
      </div>
    </div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 sm:space-y-5">{children}</div>;
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-wizard-footer
      className="mt-2 flex items-center justify-between gap-3 pt-2"
    >
      {children}
    </div>
  );
}

function PrevButton() {
  const { isFirst, onPrev, isSubmitting } = useWizard();
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onPrev}
      disabled={isFirst || isSubmitting}
      className="text-zinc-700"
    >
      이전
    </Button>
  );
}

function NextButton({ children }: { children?: React.ReactNode }) {
  const { isLast, onNext, part, isSubmitting } = useWizard();
  return (
    <Button
      type="button"
      onClick={onNext}
      disabled={isSubmitting}
      className={cn(
        'min-w-[120px] px-6 text-white shadow-md transition hover:opacity-90',
        part.theme.accentBg,
      )}
    >
      {children ?? (isLast ? '제출' : '다음')}
    </Button>
  );
}

export const SurveyWizard = Object.assign(Root, {
  Header,
  Progress,
  Step,
  Footer,
  PrevButton,
  NextButton,
});
