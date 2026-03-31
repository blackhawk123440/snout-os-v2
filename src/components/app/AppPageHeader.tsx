'use client';

import React from 'react';

export interface AppPageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function AppPageHeader({ title, subtitle, action }: AppPageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary lg:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>
        )}
      </div>
      {action && <div className="mt-2 shrink-0 sm:mt-0">{action}</div>}
    </div>
  );
}
