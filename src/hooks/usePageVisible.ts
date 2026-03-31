'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true when the page/tab is visible. Updates when user switches tabs.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  );
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);
  return visible;
}
