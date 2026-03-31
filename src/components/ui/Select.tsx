/**
 * Select Component
 *
 * Enterprise dropdown select component.
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './utils';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  size?: SelectSize;
  fullWidth?: boolean;
  placeholder?: string;
}

const sizeClasses: Record<SelectSize, string> = {
  sm: 'min-h-[2.5rem] text-sm py-2 px-3',
  md: 'min-h-[2.75rem] text-base py-3 px-4',
  lg: 'min-h-[3rem] text-lg py-4 px-5',
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      size = 'md',
      fullWidth = true,
      placeholder,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={cn(fullWidth ? 'w-full' : 'w-auto', className)}>
        {label && (
          <label
            htmlFor={selectId}
            className="block mb-2 text-sm font-medium text-text-primary"
          >
            {label}
            {props.required && (
              <span className="text-status-danger-fill ml-1">*</span>
            )}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            {...props}
            className={cn(
              'w-full font-sans rounded outline-none appearance-none pr-10',
              'transition-all duration-fast ease-standard',
              'border bg-surface-primary text-text-primary',
              error ? 'border-status-danger-fill' : 'border-border-default',
              !error && 'focus:outline-none focus:border-border-focus focus:ring-[3px] focus:ring-accent-secondary',
              props.disabled ? 'bg-surface-tertiary text-text-disabled cursor-not-allowed' : 'cursor-pointer',
              sizeClasses[size],
            )}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={
              error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined
            }
          >
            {placeholder && (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
            <ChevronDown className="w-3 h-3" />
          </span>
        </div>
        {error && (
          <div id={`${selectId}-error`} role="alert" className="mt-1 text-sm text-status-danger-fill">
            {error}
          </div>
        )}
        {!error && helperText && (
          <div id={`${selectId}-helper`} className="mt-1 text-sm text-text-secondary">
            {helperText}
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
