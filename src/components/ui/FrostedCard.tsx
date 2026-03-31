/**
 * FrostedCard Component
 * UI Constitution V1 - Surface Component
 *
 * Frosted glass effect card with token blur, border, shadow, radius.
 * Interactive and non-interactive variants with hover and focus states.
 *
 * @example
 * ```tsx
 * <FrostedCard
 *   interactive
 *   header={<h3>Title</h3>}
 *   footer={<Button>Action</Button>}
 * >
 *   Card content
 * </FrostedCard>
 * ```
 */

'use client';

import { ReactNode } from 'react';
import { cn } from './utils';

export interface FrostedCardProps {
  children?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  'data-testid'?: string;
}

export function FrostedCard({
  children,
  header,
  footer,
  interactive = false,
  onClick,
  className,
  'data-testid': testId,
}: FrostedCardProps) {
  return (
    <div
      data-testid={testId || 'frosted-card'}
      className={cn(
        'flex flex-col gap-4 relative overflow-hidden',
        'border border-border-default rounded-xl shadow-md p-5',
        'transition-all duration-150 ease-in-out',
        interactive ? 'cursor-pointer hover:shadow-md hover:-translate-y-px' : 'cursor-default',
        className
      )}
      style={{
        backgroundColor: 'var(--color-surface-frosted-mid)',
        backdropFilter: 'blur(var(--blur-md)) saturate(120%)',
        WebkitBackdropFilter: 'blur(var(--blur-md)) saturate(120%)',
      }}
      onClick={interactive ? onClick : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {header && (
        <div className="flex items-start justify-between gap-4">
          {header}
        </div>
      )}

      {children && (
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      )}

      {footer && (
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-muted">
          {footer}
        </div>
      )}
    </div>
  );
}
