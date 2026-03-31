'use client';

/**
 * DataTableShell - Wraps tables in overflow container for mobile usability.
 * Wave 3: sticky header mode, edge fade when scrollable, column priority helpers.
 */

import { cn } from './utils';

export interface DataTableShellProps {
  children: React.ReactNode;
  className?: string;
  /** Enable sticky thead when table has thead */
  stickyHeader?: boolean;
}

export function DataTableShell({ children, className, stickyHeader }: DataTableShellProps) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-lg border border-border-default',
        'shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.06)]',
        'relative',
        stickyHeader && '[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-surface-primary [&_thead_th]:shadow-[0_1px_0_0_var(--color-border-default)]',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Hide on screens smaller than md. Use for low-priority columns. */
export const colPriorityMd = 'hidden md:table-cell';

/** Hide on screens smaller than lg. Use for tertiary columns. */
export const colPriorityLg = 'hidden lg:table-cell';
