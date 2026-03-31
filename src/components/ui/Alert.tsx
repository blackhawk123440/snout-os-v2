import React from 'react';
import { tokens } from '@/lib/design-tokens';

export interface AlertProps {
  variant?: 'error' | 'success' | 'warning' | 'info';
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function Alert({ variant = 'info', children, style, className }: AlertProps) {
  const variantStyles = {
    error: {
      backgroundColor: '#FEE2E2',
      borderColor: '#EF4444',
      color: '#991B1B',
    },
    success: {
      backgroundColor: '#D1FAE5',
      borderColor: '#10B981',
      color: '#065F46',
    },
    warning: {
      backgroundColor: '#FEF3C7',
      borderColor: '#F59E0B',
      color: '#92400E',
    },
    info: {
      backgroundColor: '#DBEAFE',
      borderColor: '#3B82F6',
      color: '#1E40AF',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={className}
      style={{
        padding: tokens.spacing[3],
        borderRadius: tokens.borderRadius.md,
        border: `1px solid ${styles.borderColor}`,
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
