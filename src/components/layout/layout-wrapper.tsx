'use client';

/**
 * LayoutWrapper - Consistent max width, padding, vertical rhythm.
 * Enterprise layout with page gutters across roles.
 */

import { ReactNode } from 'react';
import { cn } from '@/components/ui/utils';

export type LayoutVariant = 'default' | 'wide' | 'narrow';

export interface LayoutWrapperProps {
  children: ReactNode;
  variant?: LayoutVariant;
  className?: string;
}

const MAX_WIDTH: Record<LayoutVariant, string> = {
  default: 'max-w-5xl',
  wide: 'max-w-7xl',
  narrow: 'max-w-6xl',
};

export function LayoutWrapper({ children, variant = 'default', className }: LayoutWrapperProps) {
  return (
    <div
      className={cn(
        'w-full px-4 py-3 pb-4 sm:px-6 lg:px-8',
        'flex flex-col gap-4',
        variant === 'narrow' ? 'lg:max-w-4xl lg:mx-auto' : cn('mx-auto', MAX_WIDTH[variant]),
        className
      )}
    >
      <div className="w-full">{children}</div>
    </div>
  );
}
