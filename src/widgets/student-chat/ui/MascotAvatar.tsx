'use client';

import { cn } from '@/shared/lib/cn';
import { MASCOT } from '../config/theme';

const SIZE_CLASS = {
  sm: 'h-8 w-8 text-base',
  md: 'h-10 w-10 text-xl',
  lg: 'h-14 w-14 text-3xl',
  xl: 'h-24 w-24 text-5xl',
} as const;

export function MascotAvatar({
  size = 'md',
  className,
}: {
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'grid shrink-0 select-none place-items-center rounded-full bg-gradient-to-br from-orange-300 to-amber-400 shadow-sm ring-2 ring-white',
        SIZE_CLASS[size],
        className,
      )}
      aria-hidden
    >
      {MASCOT}
    </span>
  );
}
