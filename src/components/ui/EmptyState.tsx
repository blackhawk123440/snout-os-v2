/**
 * EmptyState Component
 * Enterprise empty data state. No playful copy. Optional icon. primaryAction + secondaryAction.
 */

import React from 'react';
import { tokens } from '@/lib/design-tokens';
import { Button, ButtonProps } from './Button';
import { cn } from './utils';

export interface EmptyStateProps {
  icon?: React.ReactNode | string;
  title: string;
  description?: string;
  /** @deprecated Use primaryAction instead */
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
  };
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  primaryAction,
  secondaryAction,
  className,
}) => {
  const hasPrimary = primaryAction ?? action;
  const hasSecondary = secondaryAction;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-surface-primary px-6 py-8 text-center lg:rounded-lg',
        className
      )}
    >
      {icon && (
        <div
          className="mb-3 text-text-disabled"
          style={typeof icon === 'string' ? undefined : { fontSize: tokens.typography.fontSize['2xl'][0] }}
        >
          {typeof icon === 'string' ? icon : icon}
        </div>
      )}
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-text-secondary">{description}</p>
      )}
      {(hasPrimary || hasSecondary) && (
        <div className="mt-4 flex min-h-[44px] flex-wrap items-center justify-center gap-2">
          {hasPrimary && (
            <Button
              variant={action?.variant ?? 'primary'}
              size="sm"
              onClick={(primaryAction ?? action)!.onClick}
            >
              {(primaryAction ?? action)!.label}
            </Button>
          )}
          {hasSecondary && (
            <Button variant="secondary" size="sm" onClick={secondaryAction!.onClick}>
              {secondaryAction!.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

