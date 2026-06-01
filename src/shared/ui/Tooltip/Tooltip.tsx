import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

/**
 * Lightweight CSS hover tooltip (no JS, no portal). Wraps a trigger and shows
 * `label` above it on hover/focus. Good enough for icon buttons.
 */
export function Tooltip({
  label,
  children,
  className,
  side = 'top',
}: {
  label: string;
  children: ReactNode;
  className?: string;
  side?: 'top' | 'bottom';
}) {
  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
        )}
      >
        {label}
      </span>
    </span>
  );
}
