/**
 * Textarea Component
 * 
 * Enterprise multi-line text input component.
 */

import React from 'react';
import { tokens } from '@/lib/design-tokens';

export type TextareaSize = 'sm' | 'md' | 'lg';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: TextareaSize;
  fullWidth?: boolean;
  rows?: number;
}

const sizeStyles: Record<TextareaSize, { fontSize: string; padding: string }> = {
  sm: {
    fontSize: tokens.typography.fontSize.sm[0],
    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
  },
  md: {
    fontSize: tokens.typography.fontSize.base[0],
    padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
  },
  lg: {
    fontSize: tokens.typography.fontSize.lg[0],
    padding: `${tokens.spacing[4]} ${tokens.spacing[5]}`,
  },
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      size = 'md',
      fullWidth = true,
      rows = 4,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const sizeStyle = sizeStyles[size];

    return (
      <div
        style={{
          width: fullWidth ? '100%' : 'auto',
        }}
        className={className}
      >
        {label && (
          <label
            htmlFor={textareaId}
            style={{
              display: 'block',
              marginBottom: tokens.spacing[2],
              fontSize: tokens.typography.fontSize.sm[0],
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.text.primary,
            }}
          >
            {label}
            {props.required && (
              <span
                style={{
                  color: tokens.colors.error.DEFAULT,
                  marginLeft: tokens.spacing[1],
                }}
              >
                *
              </span>
            )}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          {...props}
          style={{
            width: '100%',
            fontSize: sizeStyle.fontSize,
            padding: sizeStyle.padding,
            fontFamily: tokens.typography.fontFamily.sans.join(', '),
            color: tokens.colors.text.primary,
            backgroundColor: tokens.colors.background.primary,
            border: `1px solid ${error ? tokens.colors.error.DEFAULT : tokens.colors.border.default}`,
            borderRadius: tokens.borderRadius.md,
            outline: 'none',
            resize: 'vertical',
            transition: `all ${tokens.transitions.duration.DEFAULT} ${tokens.transitions.timingFunction.DEFAULT}`,
            lineHeight: tokens.typography.fontSize.base[1].lineHeight,
            ...(props.disabled && {
              backgroundColor: tokens.colors.background.tertiary,
              color: tokens.colors.text.disabled,
              cursor: 'not-allowed',
            }),
          }}
          onFocus={(e) => {
            props.onFocus?.(e);
            if (!error) {
              e.target.style.borderColor = tokens.colors.border.focus;
              e.target.style.boxShadow = `0 0 0 3px ${tokens.colors.primary[100]}`;
            }
          }}
          onBlur={(e) => {
            props.onBlur?.(e);
            e.target.style.borderColor = error ? tokens.colors.error.DEFAULT : tokens.colors.border.default;
            e.target.style.boxShadow = 'none';
          }}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined
          }
        />
        {error && (
          <div
            id={`${textareaId}-error`}
            role="alert"
            style={{
              marginTop: tokens.spacing[1],
              fontSize: tokens.typography.fontSize.sm[0],
              color: tokens.colors.error.DEFAULT,
            }}
          >
            {error}
          </div>
        )}
        {!error && helperText && (
          <div
            id={`${textareaId}-helper`}
            style={{
              marginTop: tokens.spacing[1],
              fontSize: tokens.typography.fontSize.sm[0],
              color: tokens.colors.text.secondary,
            }}
          >
            {helperText}
          </div>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

