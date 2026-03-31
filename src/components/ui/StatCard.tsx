/**
 * StatCard Component
 * UI Constitution V1 - Surface Component
 * 
 * Metric display card with label, value, delta (optional), and icon (optional).
 * Supports loading skeleton state.
 * 
 * @example
 * ```tsx
 * <StatCard
 *   label="Total Revenue"
 *   value="$12,345"
 *   delta={{ value: 12, trend: 'up' }}
 *   icon={<DollarIcon />}
 *   loading={false}
 * />
 * ```
 */

'use client';

import { ReactNode } from 'react';
import { tokens } from '@/lib/design-tokens';
import { useMobile } from '@/lib/use-mobile';
import { Skeleton } from './Skeleton';
import { cn } from './utils';

export interface StatCardProps {
  label: string;
  value: string | number;
  delta?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
  };
  icon?: ReactNode;
  onClick?: () => void;
  loading?: boolean;
  compact?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function StatCard({
  label,
  value,
  delta,
  icon,
  onClick,
  loading = false,
  compact,
  className,
  'data-testid': testId,
}: StatCardProps) {
  const isMobile = useMobile();
  const useCompact = compact !== undefined ? compact : isMobile;
  
  const deltaColor =
    delta?.trend === 'up'
      ? tokens.colors.success.DEFAULT
      : delta?.trend === 'down'
      ? tokens.colors.error.DEFAULT
      : tokens.colors.text.secondary;

  if (loading) {
    return (
      <div
        data-testid={testId || 'stat-card'}
        className={cn('stat-card', className)}
        style={{
          backgroundColor: tokens.colors.surface.primary,
          border: `1px solid ${tokens.colors.border.default}`,
          borderRadius: tokens.radius.lg,
          padding: useCompact ? tokens.spacing[3] : tokens.spacing[6],
          minHeight: useCompact ? '80px' : '140px',
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.spacing[2],
        }}
      >
        <Skeleton height={useCompact ? '12px' : '14px'} width="60%" />
        <Skeleton height={useCompact ? '24px' : '36px'} width="80%" />
        {delta && <Skeleton height="14px" width="40%" />}
      </div>
    );
  }

  return (
    <div
      data-testid={testId || 'stat-card'}
      className={cn('stat-card', className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        backgroundColor: tokens.colors.surface.primary,
        border: `1px solid ${tokens.colors.border.muted}`, // Phase B6: Softer border for secondary panels
        borderRadius: tokens.radius.sm,
        boxShadow: 'none', // Phase B6: No shadow - reduce prominence for secondary use
        padding: useCompact ? tokens.spacing[3] : tokens.spacing[4],
        cursor: onClick ? 'pointer' : 'default',
        transition: `all ${tokens.motion.duration.fast} ${tokens.motion.easing.decelerated}`,
        minHeight: useCompact ? '72px' : '100px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = tokens.colors.border.focus;
          e.currentTarget.style.boxShadow = tokens.shadow.md;
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = tokens.colors.border.default;
          e.currentTarget.style.boxShadow = tokens.shadow.none;
        }
      }}
      onFocus={(e) => {
        if (onClick) {
          e.currentTarget.style.outline = `2px solid ${tokens.colors.border.focus}`;
          e.currentTarget.style.outlineOffset = '2px';
        }
      }}
      onBlur={(e) => {
        if (onClick) {
          e.currentTarget.style.outline = 'none';
        }
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: tokens.spacing[2],
        }}
      >
        <div
          style={{
            fontSize: tokens.typography.fontSize.xs[0],
            fontWeight: tokens.typography.fontWeight.medium,
            color: tokens.colors.text.tertiary,
            textTransform: 'uppercase',
            letterSpacing: '0.06em', // Phase B5: Slightly wider for minimalism
            lineHeight: '1.2',
            opacity: 0.65, // Phase B5: Further reduce label prominence
          }}
        >
          {label}
        </div>
        {icon && (
          <div
            style={{
              color: tokens.colors.text.tertiary,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {icon}
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: useCompact ? '1.625rem' : '1.75rem',
          fontWeight: tokens.typography.fontWeight.bold, // Phase B5: Stronger weight for instrument authority
          color: tokens.colors.text.primary,
          lineHeight: '1.0', // Phase B5: Tighter line height for precise alignment
          letterSpacing: '-0.03em', // Phase B5: Tighter tracking for numbers
          marginBottom: delta ? tokens.spacing[1] : 0,
          minHeight: useCompact ? '1.5rem' : '2rem',
          display: 'flex',
          alignItems: 'baseline', // Phase B5: Baseline alignment for instrument feel
          flexWrap: 'wrap',
          fontVariantNumeric: 'tabular-nums',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </div>
      {delta && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing[1],
            fontSize: tokens.typography.fontSize.sm[0],
            color: deltaColor,
          }}
        >
          <span>
            {delta.trend === 'up' ? '↑' : delta.trend === 'down' ? '↓' : '→'}
          </span>
          <span>{Math.abs(delta.value)}%</span>
        </div>
      )}
    </div>
  );
}
