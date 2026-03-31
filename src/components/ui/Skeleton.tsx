/**
 * Skeleton Component
 * 
 * Loading placeholder component.
 */

import React from 'react';
import { tokens } from '@/lib/design-tokens';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | false;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  variant = 'rectangular',
  animation = 'pulse',
  style,
  ...props
}) => {
  const borderRadius =
    variant === 'circular'
      ? tokens.borderRadius.full
      : variant === 'text'
      ? tokens.borderRadius.sm
      : tokens.borderRadius.md;

  const defaultHeight = variant === 'text' ? '1rem' : height || '1rem';
  const defaultWidth = variant === 'text' ? '100%' : width || '100%';

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const shouldAnimate = animation && !prefersReducedMotion;

  return (
    <>
      <div
        {...props}
        style={{
          width: typeof defaultWidth === 'number' ? `${defaultWidth}px` : defaultWidth,
          height: typeof defaultHeight === 'number' ? `${defaultHeight}px` : defaultHeight,
          backgroundColor: tokens.colors.neutral[200],
          borderRadius,
          ...(shouldAnimate && animation === 'pulse' && {
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }),
          ...(shouldAnimate && animation === 'wave' && {
            background: `linear-gradient(90deg, ${tokens.colors.neutral[200]} 25%, ${tokens.colors.neutral[100]} 50%, ${tokens.colors.neutral[200]} 75%)`,
            backgroundSize: '200% 100%',
            animation: 'wave 1.5s ease-in-out infinite',
          }),
          ...style,
        }}
        aria-hidden="true"
      />
      {shouldAnimate && (
        <style jsx>{`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
          @keyframes wave {
            0% {
              background-position: 200% 0;
            }
            100% {
              background-position: -200% 0;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            * {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
            }
          }
        `}</style>
      )}
    </>
  );
};

