'use client';

import React from 'react';

export interface AppFilterBarFilter {
  key: string;
  label: string;
  type: 'select' | 'search' | 'date';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface AppFilterBarProps {
  filters: AppFilterBarFilter[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear?: () => void;
  savedViews?: Array<{ id: string; label: string }>;
  activeView?: string;
  onViewChange?: (viewId: string) => void;
  className?: string;
}

export function AppFilterBar({
  filters,
  values,
  onChange,
  onClear,
  savedViews,
  activeView,
  onViewChange,
  className = '',
}: AppFilterBarProps) {
  const hasActiveFilters = Object.values(values).some((v) => v && v !== 'all' && v !== '');

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-border-default bg-surface-primary ${className}`}
      style={{ padding: 'var(--density-padding)' }}
    >
      {savedViews && savedViews.length > 0 && (
        <div className="flex items-center gap-1 border-r border-border-muted pr-3">
          {savedViews.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => onViewChange?.(view.id)}
              className={
                activeView === view.id
                  ? 'rounded-md bg-accent-primary px-2.5 py-1 text-xs font-medium text-text-inverse'
                  : 'rounded-md px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
              }
            >
              {view.label}
            </button>
          ))}
        </div>
      )}

      {filters.map((f) => (
        <div key={f.key} className="flex items-center gap-2">
          <label className="text-sm font-medium text-text-secondary">{f.label}</label>
          {f.type === 'select' ? (
            <select
              value={values[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
            >
              <option value="">All</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === 'search' ? (
            <input
              type="search"
              value={values[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-48 rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
          ) : (
            <input
              type="date"
              value={values[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
          )}
        </div>
      ))}
      {onClear && hasActiveFilters && (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto text-sm font-medium text-text-tertiary hover:text-text-primary"
        >
          Clear
        </button>
      )}
    </div>
  );
}
