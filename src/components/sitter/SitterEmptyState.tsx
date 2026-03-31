'use client';

import React from 'react';

export interface SitterEmptyStateProps {
  title: string;
  subtitle?: string;
  cta?: { label: string; onClick: () => void };
  icon?: React.ReactNode;
  className?: string;
}

export function SitterEmptyState({
  title,
  subtitle,
  cta,
  icon,
  className = '',
}: SitterEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-default bg-surface-primary px-8 py-12 text-center ${className}`}
    >
      {icon && <div className="mb-4 text-4xl text-text-disabled">{icon}</div>}
      <p className="text-base font-medium text-text-secondary">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-text-tertiary">{subtitle}</p>}
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          className="mt-4 min-h-[44px] min-w-[120px] rounded-xl border border-border-strong bg-surface-primary px-4 py-2.5 text-sm font-medium text-text-secondary shadow-sm transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2"
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}
