'use client';

import React from 'react';

export interface AppEmptyStateProps {
  title: string;
  subtitle?: React.ReactNode;
  cta?: { label: string; onClick: () => void };
  icon?: React.ReactNode;
  className?: string;
}

export function AppEmptyState({
  title,
  subtitle,
  cta,
  icon,
  className = '',
}: AppEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-surface-primary px-6 py-8 text-center lg:rounded-lg ${className}`}
    >
      {icon && <div className="mb-3 text-4xl text-text-disabled">{icon}</div>}
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {subtitle && <div className="mt-1 text-sm text-text-secondary">{subtitle}</div>}
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          className="mt-4 flex min-h-[44px] min-w-[120px] items-center justify-center rounded-lg bg-surface-inverse px-4 text-sm font-medium text-text-inverse transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2"
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}
