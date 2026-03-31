'use client';

/**
 * KpiGrid - Narrative, actionable KPI blocks with deltas and deep links.
 * Enterprise tone: value, delta vs prior period, subtle trend indicator.
 */

import Link from 'next/link';
import { cn } from '@/components/ui/utils';

export interface KpiItem {
  label: string;
  value: string | number;
  delta?: number; // % change vs prior period
  href?: string;
  icon?: React.ReactNode;
}

export interface KpiGridProps {
  items: KpiItem[];
  className?: string;
}

export function KpiGrid({ items, className }: KpiGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4 md:grid-cols-2 lg:grid-cols-4',
        className
      )}
    >
      {items.map((item) => (
        <KpiCard key={item.label} item={item} />
      ))}
    </div>
  );
}

function KpiCard({ item }: { item: KpiItem }) {
  const content = (
    <div
      className={cn(
        'rounded-xl border border-border-default bg-surface-primary p-4 shadow-sm transition',
        item.href
          ? 'cursor-pointer hover:border-border-muted hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1'
          : ''
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-secondary">{item.label}</p>
          <p className="mt-1 truncate text-2xl font-bold text-text-primary tabular-nums">{item.value}</p>
          {item.delta !== undefined && (
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                item.delta >= 0 ? 'text-teal-600' : 'text-status-danger-text-secondary'
              )}
            >
              {item.delta >= 0 ? '↑' : '↓'} {Math.abs(item.delta)}% vs prior period
            </p>
          )}
        </div>
        {item.icon && (
          <div className="shrink-0 text-2xl text-text-tertiary">{item.icon}</div>
        )}
      </div>
    </div>
  );

  if (item.href) {
    return (
      <Link href={item.href} className="block no-underline">
        {content}
      </Link>
    );
  }

  return content;
}
