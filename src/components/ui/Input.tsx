/**
 * Input Component
 *
 * Enterprise input field component with variants and states.
 */

import React from 'react';
import { cn } from './utils';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: InputSize;
  fullWidth?: boolean;
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'min-h-[2.5rem] text-sm py-2 px-3',
  md: 'min-h-[2.75rem] text-base py-3 px-4',
  lg: 'min-h-[3rem] text-lg py-4 px-5',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      size = 'md',
      fullWidth = true,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={cn(fullWidth ? 'w-full' : 'w-auto', className)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block mb-2 text-sm font-medium text-text-primary"
          >
            {label}
            {props.required && (
              <span className="text-status-danger-fill ml-1">*</span>
            )}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-text-tertiary flex items-center pointer-events-none z-[1]">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            {...props}
            className={cn(
              'w-full font-sans rounded outline-none',
              'transition-all duration-fast ease-standard',
              'border bg-surface-primary text-text-primary',
              error ? 'border-status-danger-fill' : 'border-border-default',
              !error && 'focus:outline-none focus:border-border-focus focus:ring-[3px] focus:ring-accent-secondary',
              props.disabled && 'bg-surface-tertiary text-text-disabled cursor-not-allowed',
              sizeClasses[size],
              !!leftIcon && 'pl-10',
              !!rightIcon && 'pr-10',
            )}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
          />
          {rightIcon && (
            <span className="absolute right-3 text-text-tertiary flex items-center pointer-events-none z-[1]">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <div
            id={`${inputId}-error`}
            role="alert"
            className="mt-1 text-sm text-status-danger-fill"
          >
            {error}
          </div>
        )}
        {!error && helperText && (
          <div
            id={`${inputId}-helper`}
            className="mt-1 text-sm text-text-secondary"
          >
            {helperText}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
