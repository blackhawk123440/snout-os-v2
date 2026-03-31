/**
 * Flex Component
 * UI Constitution V1 - Layout Helper
 * 
 * Simple flex container component for composition.
 * Uses tokens only.
 */

'use client';

import { CSSProperties, ReactNode } from 'react';
import { tokens } from '@/lib/design-tokens';
import { cn } from './utils';

export interface FlexProps {
  children?: ReactNode;
  direction?: 'row' | 'column';
  gap?: keyof typeof tokens.spacing;
  wrap?: boolean;
  align?: 'flex-start' | 'flex-end' | 'center' | 'stretch';
  justify?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around';
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

export function Flex({
  children,
  direction = 'row',
  gap,
  wrap = false,
  align,
  justify,
  className,
  style,
  'data-testid': testId,
}: FlexProps) {
  return (
    <div
      data-testid={testId || 'flex'}
      className={cn('flex', className)}
      style={{
        display: 'flex',
        flexDirection: direction,
        gap: gap ? tokens.spacing[gap] : undefined,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        alignItems: align,
        justifyContent: justify,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
