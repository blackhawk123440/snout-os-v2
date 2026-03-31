'use client';

/**
 * Section - Standardizes section spacing and headers inside pages.
 * Enterprise data-dense layout.
 */

import { ReactNode } from 'react';
import { cn } from '@/components/ui/utils';

export interface SectionProps {
  title?: string;
  description?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ title, description, right, children, className }: SectionProps) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      {(title || description || right) && (
        <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-base font-semibold tracking-tight text-text-primary">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-text-secondary">{description}</p>
            )}
          </div>
          {right && <div className="flex-shrink-0">{right}</div>}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}
