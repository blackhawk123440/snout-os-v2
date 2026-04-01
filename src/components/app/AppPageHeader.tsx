'use client';

import React from 'react';

export interface AppPageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function AppPageHeader({ title, subtitle, action }: AppPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary lg:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
