/**
 * Switch Component
 * UI Constitution V1 - Control Component
 * 
 * Accessible toggle switch with label association.
 * 
 * @example
 * ```tsx
 * <Switch
 *   checked={enabled}
 *   onChange={(checked) => setEnabled(checked)}
 *   label="Enable notifications"
 *   description="Receive push notifications"
 * />
 * ```
 */

'use client';

import { ReactNode } from 'react';
import { tokens } from '@/lib/design-tokens';
import { cn, generateId } from './utils';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: SwitchProps) {
  const switchId = generateId('switch');
  const descriptionId = description ? generateId('switch-desc') : undefined;

  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <div
      data-testid={testId || 'switch'}
      className={cn('switch-container', className)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: tokens.spacing[3],
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || label}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        style={{
          position: 'relative',
          width: '44px',
          height: '24px',
          borderRadius: '12px',
          border: 'none',
          backgroundColor: checked
            ? tokens.colors.primary.DEFAULT
            : tokens.colors.neutral[300],
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: `background-color ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
          opacity: disabled ? 0.5 : 1,
          flexShrink: 0,
          padding: '2px',
        }}
        onFocus={(e) => {
          if (!disabled) {
            e.currentTarget.style.outline = `2px solid ${tokens.colors.border.focus}`;
            e.currentTarget.style.outlineOffset = '2px';
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none';
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '2px',
            left: checked ? '22px' : '2px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: tokens.colors.surface.primary,
            boxShadow: tokens.shadow.sm,
            transition: `left ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
          }}
        />
      </button>
      
      {(label || description) && (
        <label
          htmlFor={switchId}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing[1],
            flex: 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          onClick={(e) => {
            if (!disabled) {
              e.preventDefault();
              onChange(!checked);
            }
          }}
        >
          {label && (
            <span
              style={{
                fontSize: tokens.typography.fontSize.base[0],
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.text.primary,
              }}
            >
              {label}
            </span>
          )}
          {description && (
            <span
              id={descriptionId}
              style={{
                fontSize: tokens.typography.fontSize.sm[0],
                color: tokens.colors.text.secondary,
              }}
            >
              {description}
            </span>
          )}
        </label>
      )}
    </div>
  );
}
