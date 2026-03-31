'use client';

/**
 * useQueryState - Sync state with URL query params for enterprise UX.
 * Persists filters, date ranges, etc. in query string (?range=7d|30d).
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export function useQueryState<T extends string>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const value = useMemo(() => {
    const v = searchParams.get(key);
    return (v as T) ?? defaultValue;
  }, [searchParams, key, defaultValue]);

  const setValue = useCallback(
    (newValue: T) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newValue === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, newValue);
      }
      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      router.replace(href);
    },
    [key, defaultValue, pathname, router, searchParams]
  );

  return [value, setValue];
}
