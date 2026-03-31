'use client';

import { Loader2, RotateCw } from 'lucide-react';

/**
 * Small icon button for client portal page headers.
 * Replaces floating "Refresh" text links with a restrained, accessible control.
 */

export interface ClientRefreshButtonProps {
  onRefresh: () => void;
  loading?: boolean;
  className?: string;
}

export function ClientRefreshButton({ onRefresh, loading, className = '' }: ClientRefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={() => void onRefresh()}
      disabled={loading}
      aria-label="Refresh"
      title="Refresh"
      className={`flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md text-text-tertiary transition hover:bg-surface-tertiary hover:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <RotateCw className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
