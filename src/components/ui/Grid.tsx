/**
 * Grid Component
 * UI Constitution V1 - Layout Primitive
 * 
 * Locked 12 column grid for desktop. On mobile collapses to 1 column.
 * Gutters tokenized. No freeform grid in pages.
 * 
 * @example
 * ```tsx
 * <Grid>
 *   <Grid.Col span={12} md={6} lg={4}>Item 1</Grid.Col>
 *   <Grid.Col span={12} md={6} lg={4}>Item 2</Grid.Col>
 *   <Grid.Col span={12} md={6} lg={4}>Item 3</Grid.Col>
 * </Grid>
 * ```
 */

'use client';

import { ReactNode } from 'react';
import { tokens } from '@/lib/design-tokens';
import { useMobile } from '@/lib/use-mobile';
import { cn } from './utils';

export interface GridProps {
  children?: ReactNode;
  gap?: keyof typeof tokens.spacing;
  className?: string;
  'data-testid'?: string;
}

export interface GridColProps {
  children?: ReactNode;
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  md?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  lg?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  className?: string;
  'data-testid'?: string;
}

function GridCol({ children, span = 12, md, lg, className, 'data-testid': testId }: GridColProps) {
  const isMobile = useMobile();
  
  // On mobile, always full width
  const mobileSpan = 12;
  const tabletSpan = md || span;
  const desktopSpan = lg || md || span;

  // Determine column span based on screen width
  const columnSpan = typeof window !== 'undefined' && window.innerWidth >= 1024
    ? desktopSpan
    : isMobile ? mobileSpan : tabletSpan;

  return (
    <div
      data-testid={testId || 'grid-col'}
      className={cn('grid-col', className)}
      style={{
        gridColumn: `span ${columnSpan} / span ${columnSpan}`,
      }}
    >
      {children}
    </div>
  );
}

export function Grid({
  children,
  gap = 4,
  className,
  'data-testid': testId,
}: GridProps) {
  const gapValue = tokens.spacing[gap];

  return (
    <div
      data-testid={testId || 'grid'}
      className={cn('grid', className)}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gap: gapValue,
        width: '100%',
      }}
    >
      {children}
    </div>
  );
}

Grid.Col = GridCol;
export { GridCol };
