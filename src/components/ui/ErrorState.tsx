/**
 * ErrorState Component
 * UI Constitution V1 - Data Component
 * 
 * Error state display with action slots and consistent visuals.
 * 
 * @example
 * ```tsx
 * <ErrorState
 *   title="Something went wrong"
 *   message="Failed to load data"
 *   action={<Button onClick={retry}>Retry</Button>}
 * />
 * ```
 */

'use client';

import { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { tokens } from '@/lib/design-tokens';
import { cn } from './utils';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  action,
  icon,
  className,
  'data-testid': testId,
}: ErrorStateProps) {
  return (
    <div
      data-testid={testId || 'error-state'}
      className={cn('error-state', className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing[12],
        textAlign: 'center',
        gap: tokens.spacing[4],
      }}
    >
      {icon || (
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: tokens.colors.error[50],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: tokens.colors.error.DEFAULT,
            fontSize: '32px',
          }}
        >
          <AlertTriangle className="w-8 h-8" />
        </div>
      )}
      
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.spacing[2],
        }}
      >
        <h3
          style={{
            fontSize: tokens.typography.fontSize.xl[0],
            fontWeight: tokens.typography.fontWeight.bold,
            color: tokens.colors.text.primary,
            margin: 0,
          }}
        >
          {title}
        </h3>
        {message && (
          <p
            style={{
              fontSize: tokens.typography.fontSize.base[0],
              color: tokens.colors.text.secondary,
              margin: 0,
            }}
          >
            {message}
          </p>
        )}
      </div>
      
      {action && (
        <div style={{ marginTop: tokens.spacing[2] }}>{action}</div>
      )}
    </div>
  );
}
