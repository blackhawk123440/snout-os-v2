'use client';

/**
 * PageHeader - Standard page header with title, subtitle, actions, breadcrumbs.
 * Enterprise tone: consistent spacing + typography.
 */

import { ReactNode } from 'react';
import { cn } from '@/components/ui/utils';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
  /** Optional data-testid for stable E2E selectors */
  testId?: string;
}

export function PageHeader({ title, subtitle, actions, breadcrumbs, className, testId }: PageHeaderProps) {
  return (
    <header className={cn('mb-4', className)} data-testid={testId ?? 'page-header'}>
      {breadcrumbs && <div className="mb-1.5">{breadcrumbs}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-text-primary lg:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
