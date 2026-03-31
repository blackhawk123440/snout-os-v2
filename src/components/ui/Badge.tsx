/**
 * Badge Component
 *
 * Status and type indicators with semantic variants.
 */

import React from 'react';
import { cn } from './utils';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-accent-secondary text-accent-primary',
  success: 'bg-status-success-bg text-status-success-text',
  warning: 'bg-status-warning-bg text-status-warning-text',
  error: 'bg-status-danger-bg text-status-danger-text',
  info: 'bg-status-info-bg text-status-info-text',
  neutral: 'bg-surface-secondary text-text-secondary',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  className,
  ...props
}) => {
  return (
    <span
      {...props}
      className={cn(
        'inline-flex items-center px-2 py-1 text-xs font-medium leading-none rounded-sm',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
