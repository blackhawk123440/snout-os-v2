/**
 * FormRow Component
 *
 * Form field wrapper with consistent spacing.
 */

import React from 'react';

export interface FormRowProps {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
}

export const FormRow: React.FC<FormRowProps> = ({
  label,
  required,
  error,
  helperText,
  children,
}) => {
  return (
    <div className="mb-6">
      {label && (
        <label className="block mb-2 text-sm font-medium text-text-primary">
          {label}
          {required && (
            <span className="text-error ml-1">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error && (
        <div
          role="alert"
          className="mt-1 text-sm text-error"
        >
          {error}
        </div>
      )}
      {!error && helperText && (
        <div className="mt-1 text-sm text-text-secondary">
          {helperText}
        </div>
      )}
    </div>
  );
};
