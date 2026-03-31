'use client';

/**
 * InteractiveRow - Clickable table/list row with enterprise hover affordance.
 * Use for messages list, bookings list, payouts/reconciliation tables.
 */

import { forwardRef } from 'react';
import { cn } from './utils';

export interface InteractiveRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  as?: 'div' | 'tr';
}

export const InteractiveRow = forwardRef<HTMLDivElement, InteractiveRowProps>(
  ({ children, className, as: As = 'div', ...props }, ref) => {
    const base =
      'cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1';
    const hover = 'hover:bg-surface-secondary';
    const active = 'active:bg-surface-tertiary';

    if (As === 'tr') {
      return (
        <tr
          ref={ref as React.Ref<HTMLTableRowElement>}
          className={cn(base, hover, active, 'border-b border-border-default', className)}
          {...(props as React.HTMLAttributes<HTMLTableRowElement>)}
        >
          {children}
        </tr>
      );
    }

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            (e.currentTarget as HTMLDivElement).click();
          }
          props.onKeyDown?.(e);
        }}
        className={cn(
          base,
          hover,
          active,
          'flex min-h-[56px] items-center gap-3 border-b border-border-default px-4 py-2 lg:min-h-[44px] lg:py-1.5',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

InteractiveRow.displayName = 'InteractiveRow';
