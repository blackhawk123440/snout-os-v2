'use client';

/**
 * LoadingState - Enterprise loading patterns.
 * TableSkeleton, CardSkeleton, PageSkeleton.
 * Minimal animation; respects prefers-reduced-motion.
 */

import { Skeleton } from './Skeleton';

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full space-y-2">
      {/* Header */}
      <div className="flex gap-4 border-b border-border-default pb-2">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex-1">
            <Skeleton variant="text" height={16} animation={false} />
          </div>
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="flex-1">
              <Skeleton variant="text" height={16} animation={false} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-lg border border-border-muted bg-surface-primary p-4">
      <div className="space-y-3">
        <div className="w-1/3">
          <Skeleton variant="text" height={20} animation={false} />
        </div>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} variant="text" height={16} animation={false} />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton variant="text" className="h-8 w-64" animation={false} />
        <Skeleton variant="text" className="h-4 w-96" animation={false} />
      </div>
      {/* Content blocks */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} lines={2} />
        ))}
      </div>
      <div className="rounded-lg border border-border-muted bg-surface-primary p-4">
        <TableSkeleton rows={8} cols={4} />
      </div>
    </div>
  );
}
