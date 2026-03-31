/**
 * Button Component
 *
 * Enterprise button component with variants and sizes.
 * All buttons in the dashboard must use this component.
 * On mobile, ensures minimum touch target size of 44px.
 */

import React from 'react';
import { useMobile } from '@/lib/use-mobile';
import { cn } from './utils';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent-primary text-text-inverse border border-accent-primary shadow-none hover:brightness-90',
  secondary: 'bg-surface-primary text-text-primary border border-border-default shadow-none hover:bg-surface-secondary hover:border-border-strong',
  tertiary: 'bg-transparent text-text-primary border border-transparent shadow-none hover:bg-surface-secondary',
  danger: 'bg-status-danger-fill text-text-inverse border border-status-danger-fill shadow-none hover:brightness-90',
  ghost: 'bg-transparent text-text-secondary border border-transparent shadow-none hover:bg-surface-secondary hover:text-text-primary',
};

const getSizeClasses = (size: ButtonSize, isMobile: boolean): string => {
  const sizes: Record<ButtonSize, string> = {
    sm: isMobile
      ? 'px-3 py-2 text-sm h-11 min-h-[44px]'
      : 'px-3 py-2 text-sm h-8',
    md: isMobile
      ? 'px-4 py-3 text-base h-11 min-h-[44px]'
      : 'px-5 py-[0.625rem] text-base h-[2.25rem]',
    lg: isMobile
      ? 'px-5 py-3 text-base h-11 min-h-[44px]'
      : 'px-6 py-4 text-lg h-12',
  };
  return sizes[size];
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const isMobile = useMobile();
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded font-semibold font-sans leading-tight',
          'transition-all duration-fast ease-decelerated touch-manipulation',
          variantClasses[variant],
          getSizeClasses(size, isMobile),
          isDisabled && 'opacity-50 cursor-not-allowed',
          !isDisabled && 'cursor-pointer',
          className
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        {...props}
      >
        {isLoading && (
          <span
            className="inline-block w-[1em] h-[1em] border-2 border-current border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
        )}
        {!isLoading && leftIcon && <span>{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span>{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
