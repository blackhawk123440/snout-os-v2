'use client';

import React, { useState, useEffect } from 'react';

const PREFIX = 'snout-table-';

export interface SavedView {
  id: string;
  label: string;
}

export interface SavedViewsDropdownProps {
  views?: SavedView[];
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
  /** Persist selection to localStorage per route (e.g. 'bookings', 'clients') */
  persistKey?: string;
}

const DEFAULT_VIEWS: SavedView[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This week' },
  { id: 'my_sitters', label: 'My sitters' },
  { id: 'unassigned', label: 'Unassigned' },
];

function loadStored(route: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(`${PREFIX}${route}:savedView`);
  } catch {
    return null;
  }
}

function saveStored(route: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${PREFIX}${route}:savedView`, value);
  } catch {
    // ignore
  }
}

export function SavedViewsDropdown({
  views = DEFAULT_VIEWS,
  value: controlledValue,
  onChange,
  className = '',
  persistKey,
}: SavedViewsDropdownProps) {
  const [internalValue, setInternalValue] = useState(() =>
    persistKey ? (loadStored(persistKey) ?? 'all') : 'all'
  );
  const value = controlledValue ?? internalValue;

  useEffect(() => {
    if (persistKey) saveStored(persistKey, value);
  }, [persistKey, value]);

  const handleChange = (v: string) => {
    if (controlledValue === undefined) setInternalValue(v);
    onChange?.(v);
  };

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className={`rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 ${className}`}
      style={{ padding: 'var(--density-row) var(--density-gap)' }}
      aria-label="Saved view"
    >
      {views.map((v) => (
        <option key={v.id} value={v.id}>
          {v.label}
        </option>
      ))}
    </select>
  );
}
