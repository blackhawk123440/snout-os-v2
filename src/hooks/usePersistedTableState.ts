'use client';

import { useState, useEffect, useCallback } from 'react';

const PREFIX = 'snout-table-';

function getKey(route: string, key: string) {
  return `${PREFIX}${route}:${key}`;
}

function load<T>(route: string, key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(getKey(route, key));
    if (raw == null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function save<T>(route: string, key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getKey(route, key), JSON.stringify(value));
  } catch {
    // ignore
  }
}

/** Persist SavedViewsDropdown selection per route */
export function usePersistedSavedView(route: string, defaultView = 'all') {
  const [value, setValueState] = useState<string>(() => load(route, 'savedView', defaultView));

  useEffect(() => {
    save(route, 'savedView', value);
  }, [route, value]);

  const setValue = useCallback((v: string) => setValueState(v), []);
  return [value, setValue] as const;
}

/** Persist AppTable column visibility per route */
export function usePersistedColumnVisibility(
  route: string,
  columnKeys: string[]
): [Set<string>, (visible: Set<string>) => void] {
  const [visible, setVisibleState] = useState<Set<string>>(() => {
    const stored = load<string[]>(route, 'columns', columnKeys);
    return new Set(stored);
  });

  useEffect(() => {
    save(route, 'columns', Array.from(visible));
  }, [route, visible]);

  const setVisible = useCallback((v: Set<string>) => setVisibleState(v), []);
  return [visible, setVisible];
}

/** Persist default filters/sorts per route */
export function usePersistedFilters(route: string, defaults: Record<string, string> = {}) {
  const [values, setValuesState] = useState<Record<string, string>>(() =>
    load(route, 'filters', defaults)
  );

  useEffect(() => {
    save(route, 'filters', values);
  }, [route, values]);

  const setValues = useCallback((v: Record<string, string> | ((p: Record<string, string>) => Record<string, string>)) => {
    setValuesState((prev) => (typeof v === 'function' ? v(prev) : v));
  }, []);

  const setOne = useCallback((key: string, value: string) => {
    setValuesState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clear = useCallback(() => setValuesState(defaults), [defaults]);

  return { values, setValues, setOne, clear };
}
