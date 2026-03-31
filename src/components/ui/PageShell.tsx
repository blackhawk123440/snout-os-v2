/**
 * PageShell Component
 * UI Constitution V1 - Layout Primitive
 * 
 * Single allowed scroll surface for any route.
 * Owns page padding, max width, background, and vertical rhythm.
 * Must be the only element on a route that can scroll vertically.
 * 
 * @example
 * ```tsx
 * <PageShell>
 *   <TopBar title="Dashboard" />
 *   <SideNav />
 *   <main>Content here</main>
 * </PageShell>
 * ```
 */

'use client';

import { ReactNode } from 'react';
import { tokens } from '@/lib/design-tokens';
import { cn } from './utils';

export interface PageShellProps {
  children?: ReactNode;
  className?: string;
  maxWidth?: string;
  background?: 'primary' | 'secondary' | 'tertiary';
  padding?: boolean;
  'data-testid'?: string;
}

/**
 * PageShell - Single scroll surface container
 * 
 * This is the ONLY component that should have vertical scroll.
 * All page layouts must use this component.
 */
export function PageShell({
  children,
  className,
  maxWidth,
  background = 'secondary',
  padding = true,
  'data-testid': testId,
}: PageShellProps) {
  const backgroundColors = {
    primary: tokens.colors.surface.primary,
    secondary: tokens.colors.surface.secondary,
    tertiary: tokens.colors.surface.tertiary,
  };

  return (
    <div
      data-testid={testId || 'page-shell'}
      className={cn('page-shell', className)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: background === 'primary' ? tokens.colors.surface.base : backgroundColors[background],
        overflow: 'hidden', // Prevent body scroll
        width: '100%',
        height: '100vh',
        maxWidth: '100vw',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          width: '100%',
          maxWidth: maxWidth || tokens.layout.page.maxWidth, // Phase B3: Constrained width
          margin: '0 auto',
          padding: padding ? `${tokens.spacing[5]} ${tokens.spacing[6]}` : 0, // Phase B3: Tighter padding
          overflowY: 'auto', // ONLY scroll surface allowed
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
        }}
      >
        {children}
      </div>
    </div>
  );
}
