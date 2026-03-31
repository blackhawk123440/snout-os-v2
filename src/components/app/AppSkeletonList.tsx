'use client';

import React from 'react';

export interface AppSkeletonListProps {
  count?: number;
  className?: string;
}

export function AppSkeletonList({ count = 3, className = '' }: AppSkeletonListProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-border-default bg-surface-primary p-5 shadow-sm"
        >
          <div className="mb-3 flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-surface-tertiary" />
            <div className="min-w-0 flex-1">
              <div className="mb-2 h-4 w-1/2 rounded bg-surface-tertiary" />
              <div className="h-3 w-1/3 rounded bg-surface-secondary" />
            </div>
          </div>
          <div className="mb-3 h-3 w-full rounded bg-surface-secondary" />
          <div className="flex gap-2">
            <div className="h-9 flex-1 rounded-lg bg-surface-secondary" />
            <div className="h-9 flex-1 rounded-lg bg-surface-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}
