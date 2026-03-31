'use client';

import React from 'react';
import { AppCard } from './AppCard';

export interface AppChartCardProps {
  title: string;
  subtitle?: string;
  timeframes?: Array<{ value: string; label: string }>;
  timeframe?: string;
  onTimeframeChange?: (value: string) => void;
  headerRight?: React.ReactNode;
  children?: React.ReactNode;
  loading?: boolean;
  isLoading?: boolean;
  empty?: boolean;
  isEmpty?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

const TIMEFRAME_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export function AppChartCard({
  title,
  subtitle,
  timeframes,
  timeframe = '30d',
  onTimeframeChange,
  headerRight,
  children,
  loading = false,
  isLoading = false,
  empty = false,
  isEmpty = false,
  error,
  onRetry,
  className = '',
}: AppChartCardProps) {
  const resolvedLoading = loading || isLoading;
  const resolvedEmpty = empty || isEmpty;
  const options = timeframes && timeframes.length > 0 ? timeframes : TIMEFRAME_OPTIONS;

  return (
    <AppCard className={className}>
      <div className="px-5 pt-5 pb-3" style={{ padding: 'var(--density-padding)' }}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 sm:mt-0">
            {onTimeframeChange && (
              <select
                value={timeframe}
                onChange={(e) => onTimeframeChange(e.target.value)}
                className="rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary"
                aria-label="Timeframe"
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {headerRight}
          </div>
        </div>
      </div>
      <div
        className="mx-5 mb-5 min-h-[200px] rounded-lg border-2 border-dashed border-border-muted bg-surface-secondary"
        style={{ padding: 'var(--density-padding)', margin: '0 var(--density-padding) var(--density-padding)' }}
      >
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-text-secondary">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 text-sm font-medium text-teal-600 hover:underline"
              >
                Retry
              </button>
            )}
          </div>
        ) : resolvedLoading ? (
          <div className="flex aspect-video animate-pulse items-center justify-center">
            <div className="h-32 w-full rounded bg-border-muted" />
          </div>
        ) : resolvedEmpty ? (
          <div className="flex aspect-video items-center justify-center text-sm text-text-tertiary">
            No data
          </div>
        ) : (
          children ?? (
            <div className="flex aspect-video items-center justify-center text-sm text-text-tertiary">
              Chart placeholder
            </div>
          )
        )}
      </div>
    </AppCard>
  );
}
