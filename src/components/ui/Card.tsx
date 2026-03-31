/**
 * Card Component
 *
 * Content container with consistent styling and optional header/footer.
 * On mobile, uses compact padding automatically.
 */

import React from 'react';
import { useMobile } from '@/lib/use-mobile';
import { cn } from './utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  header,
  footer,
  padding = true,
  className,
  ...props
}) => {
  const isMobile = useMobile();

  return (
    <div
      {...props}
      className={cn(
        'bg-surface-primary border border-border-default rounded-lg shadow-sm overflow-visible',
        className
      )}
    >
      {header && (
        <div
          className={cn(
            'border-b border-border-default',
            padding && (isMobile ? 'px-3 pt-3 pb-2' : 'px-4 pt-4 pb-3')
          )}
        >
          {header}
        </div>
      )}
      <div className={cn(padding && (isMobile ? 'p-3' : 'p-4'))}>
        {children}
      </div>
      {footer && (
        <div
          className={cn(
            'border-t border-border-default bg-surface-secondary',
            padding && (isMobile ? 'px-3 pt-2 pb-3' : 'px-4 pt-3 pb-4')
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
};
