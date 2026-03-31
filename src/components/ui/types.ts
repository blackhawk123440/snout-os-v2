/**
 * Shared Types for UI Kit Components
 * UI Constitution V1
 */

import { ReactNode } from 'react';

/**
 * Component size variants
 */
export type Size = 'sm' | 'md' | 'lg';

/**
 * Color variant types
 */
export type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'success' | 'warning' | 'error' | 'info';

/**
 * Status variants for badges and states
 */
export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

/**
 * Base component props with common patterns
 */
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
  'data-testid'?: string;
}

/**
 * Slot pattern for flexible layouts
 */
export interface SlotProps {
  header?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
}

/**
 * Loading state props
 */
export interface LoadingProps {
  loading?: boolean;
  loadingText?: string;
}

/**
 * Disabled state props
 */
export interface DisabledProps {
  disabled?: boolean;
}

/**
 * Error state props
 */
export interface ErrorProps {
  error?: string | boolean;
  errorMessage?: string;
}

/**
 * Label and description pattern
 */
export interface LabelProps {
  label?: string;
  description?: string;
  required?: boolean;
  htmlFor?: string;
}

/**
 * Actions slot pattern
 */
export interface ActionsProps {
  actions?: ReactNode;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
}

/**
 * Icon props
 */
export interface IconProps {
  icon?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/**
 * Responsive behavior props
 */
export interface ResponsiveProps {
  mobile?: ReactNode;
  desktop?: ReactNode;
  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
}

/**
 * Focus management props
 */
export interface FocusProps {
  autoFocus?: boolean;
  focusVisible?: boolean;
}

/**
 * Aria label props for accessibility
 */
export interface AriaProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-live'?: 'polite' | 'assertive' | 'off';
}
