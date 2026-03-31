'use client';

import React from 'react';
import { getStatusPill } from './getStatusPill';
import { StatusChip, type StatusChipVariant } from '@/components/ui/status-chip';

export interface AppStatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; label?: string };
  sublabel?: string;
  className?: string;
}

export function AppStatCard({ label, value, icon, trend, sublabel, className = '' }: AppStatCardProps) {
  return (
    <div
      className={`rounded-lg border border-border-default bg-surface-primary p-5 shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-tertiary">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tabular-nums tracking-tight text-text-primary">{value}</p>
          {sublabel && <p className="mt-0.5 text-xs text-text-tertiary">{sublabel}</p>}
          {trend !== undefined && (
            <p
              className={`mt-1 text-xs font-medium ${
                trend.value >= 0 ? 'text-teal-600' : 'text-status-danger-text-secondary'
              }`}
            >
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ''}
            </p>
          )}
        </div>
        {icon && <div className="shrink-0 text-2xl text-text-tertiary">{icon}</div>}
      </div>
    </div>
  );
}

const PILL_TO_CHIP: Record<string, StatusChipVariant> = {
  default: 'neutral',
  success: 'success',
  warning: 'warning',
  error: 'danger',
  info: 'info',
};

export interface AppStatusPillProps {
  status: string;
  className?: string;
}

export function AppStatusPill({ status, className = '' }: AppStatusPillProps) {
  const { variant, label } = getStatusPill(status);
  return (
    <StatusChip variant={PILL_TO_CHIP[variant] ?? 'neutral'} className={className}>
      {label}
    </StatusChip>
  );
}
