/**
 * IconButton Component
 * UI Constitution V1 - Control Component
 *
 * Icon-only button with variants, sizes, loading state, and full accessibility.
 *
 * @example
 * ```tsx
 * <IconButton
 *   icon={<CloseIcon />}
 *   variant="ghost"
 *   size="md"
 *   aria-label="Close dialog"
 *   onClick={() => {}}
 * />
 * ```
 */

'use client';

import { ReactNode } from 'react';
import { useMobile } from '@/lib/use-mobile';
import { Size, Variant } from './types';
import { cn } from './utils';

export interface IconButtonProps {
  icon: ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  'aria-label': string;
  className?: string;
  'data-testid'?: string;
}

const variantClasses: Record<string, string> = {
  primary: 'bg-primary text-white border border-primary',
  secondary: 'bg-surface-primary text-text-primary border border-border-default',
  ghost: 'bg-transparent text-text-secondary border border-transparent hover:bg-accent-secondary hover:text-text-primary',
  destructive: 'bg-error text-white border border-error',
  error: 'bg-error text-white border border-error',
  success: 'bg-success text-white border border-success',
  warning: 'bg-warning text-white border border-warning',
  info: 'bg-blue-500 text-white border border-blue-500',
};

const sizeClasses: Record<string, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  'aria-label': ariaLabel,
  className,
  'data-testid': testId,
}: IconButtonProps) {
  const isMobile = useMobile();
  const effectiveDisabled = disabled || loading;

  const sizePixels: Record<string, { width: string; height: string }> = {
    sm: { width: isMobile ? '44px' : '32px', height: isMobile ? '44px' : '32px' },
    md: { width: '44px', height: '44px' },
    lg: { width: '48px', height: '48px' },
  };

  return (
    <button
      data-testid={testId || 'icon-button'}
      className={cn(
        'inline-flex items-center justify-center rounded-xl p-0 relative',
        'transition-all duration-150 ease-in-out',
        'focus:outline-2 focus:outline-border-focus focus:outline-offset-2',
        variantClasses[variant] || variantClasses.ghost,
        sizeClasses[size],
        effectiveDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
        className
      )}
      style={sizePixels[size]}
      type="button"
      onClick={onClick}
      disabled={effectiveDisabled}
      aria-label={loading ? `${ariaLabel} (loading)` : ariaLabel}
      aria-busy={loading}
    >
      {loading ? (
        <span
          className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : (
        <span className="flex items-center justify-center">
          {icon}
        </span>
      )}
    </button>
  );
}
