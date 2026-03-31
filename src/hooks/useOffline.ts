'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getQueuedCount, getPendingPhotosCount, processQueue } from '@/lib/offline';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [queuedPhotosCount, setQueuedPhotosCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshQueuedCount = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const [count, photosCount] = await Promise.all([
        getQueuedCount(),
        getPendingPhotosCount(),
      ]);
      setQueuedCount(count);
      setQueuedPhotosCount(photosCount);
    } catch {
      setQueuedCount(0);
      setQueuedPhotosCount(0);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine || syncingRef.current) return { processed: 0, failed: 0 };
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await processQueue();
      await refreshQueuedCount();
      return result;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshQueuedCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    void refreshQueuedCount();
    const handleOnline = () => {
      setIsOnline(true);
      void refreshQueuedCount().then(async () => {
        const count = await getQueuedCount();
        if (count > 0) void syncNow();
      });
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshQueuedCount, syncNow]);

  return { isOnline, queuedCount, queuedPhotosCount, syncing, syncNow, refreshQueuedCount };
}
