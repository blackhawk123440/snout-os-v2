'use client';

import React from 'react';
import { Wifi, CloudUpload } from 'lucide-react';
import { useOffline } from '@/hooks/useOffline';

export function SitterOfflineBanner() {
  const { isOnline, queuedCount, queuedPhotosCount, syncing, syncNow } = useOffline();

  if (isOnline && queuedCount === 0 && queuedPhotosCount === 0) return null;

  return (
    <div className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-status-warning-bg px-4 py-2 text-sm font-medium text-status-warning-text">
      {!isOnline ? (
        <>
          <Wifi className="w-4 h-4 text-status-warning-text-secondary" />
          <span>You&apos;re offline. Actions will sync when you reconnect.</span>
          {queuedPhotosCount > 0 && (
            <span className="ml-1 rounded bg-status-warning-border px-2 py-0.5 text-xs">Photos queued: {queuedPhotosCount}</span>
          )}
        </>
      ) : (
        <>
          <CloudUpload className="w-4 h-4 text-status-warning-text-secondary" />
          <span>{queuedCount} action{queuedCount !== 1 ? 's' : ''} queued</span>
          {queuedPhotosCount > 0 && (
            <span className="rounded bg-status-warning-border px-2 py-0.5 text-xs">Photos queued: {queuedPhotosCount}</span>
          )}
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncing}
            className="ml-2 rounded-lg bg-status-warning-border px-2.5 py-1 text-xs font-semibold text-status-warning-text transition hover:bg-status-warning-fill disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </>
      )}
    </div>
  );
}
