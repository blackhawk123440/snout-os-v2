'use client';

/**
 * RouteMap — Visual route map showing today's stops.
 * Uses static map images (no Mapbox/Google Maps JS SDK needed).
 * Falls back to a list view if no addresses have coordinates.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatServiceName } from '@/lib/format-utils';

interface RouteStop {
  stopNumber: number;
  bookingId: string;
  clientName: string;
  address: string | null;
  service: string;
  startAt: string;
  endAt: string;
  status: string;
  pets: string;
  phone?: string | null;
  notes?: string | null;
  googleMapsUrl?: string | null;
  appleMapsUrl?: string | null;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: 'var(--color-status-info-bg)', text: 'var(--color-status-info-text)', label: 'Upcoming' },
  in_progress: { bg: 'var(--color-status-purple-bg)', text: 'var(--color-status-purple-text)', label: 'In Progress' },
  completed: { bg: 'var(--color-status-success-bg)', text: 'var(--color-status-success-text)', label: 'Completed' },
  pending: { bg: 'var(--color-status-warning-bg)', text: 'var(--color-status-warning-text)', label: 'Pending' },
};

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function RouteMap({ date, apiUrl, showShare = false }: { date?: string; apiUrl?: string; showShare?: boolean }) {
  const [expandedStop, setExpandedStop] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const targetDate = date || new Date().toISOString().slice(0, 10);
  const endpoint = apiUrl || `/api/sitter/route?date=${targetDate}`;

  const { data, isLoading, error } = useQuery({
    queryKey: ['route-map', endpoint],
    queryFn: async () => {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Failed to load route');
      return res.json();
    },
    refetchInterval: 30000, // Live updates every 30s
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="h-[200px] bg-surface-tertiary rounded-xl flex items-center justify-center">
          <span className="text-text-tertiary">Loading route...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 text-center text-text-secondary">
        Unable to load route
      </div>
    );
  }

  const stops: RouteStop[] = data.stops || [];

  if (stops.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-[32px] mb-2">🗺️</p>
        <p className="font-semibold text-text-primary">No stops today</p>
        <p className="text-sm text-text-secondary">
          Your route will appear here when you have bookings
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Route summary */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-border-default">
        <div>
          <span className="font-semibold text-text-primary">
            {stops.length} stop{stops.length !== 1 ? 's' : ''} today
          </span>
          <span className="ml-2 text-sm text-text-tertiary">
            {stops.filter(s => s.status === 'completed').length} completed
          </span>
        </div>
        <div className="flex gap-2 items-center">
          {showShare && (
            <button
              type="button"
              onClick={async () => {
                setSharing(true);
                try {
                  const res = await fetch('/api/sitter/route/share', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: targetDate }),
                  });
                  const json = await res.json();
                  if (json.shareUrl) {
                    if (navigator.share) {
                      await navigator.share({ title: 'My Route', url: json.shareUrl });
                    } else {
                      await navigator.clipboard.writeText(json.shareUrl);
                      alert('Route link copied!');
                    }
                  }
                } catch {} finally { setSharing(false); }
              }}
              disabled={sharing}
              className="min-h-[44px] inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-text-secondary border border-border-default bg-transparent cursor-pointer"
            >
              {sharing ? 'Sharing...' : '📤 Share'}
            </button>
          )}
          {data.navigation?.googleMapsUrl && (
            <a
              href={data.navigation.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold text-text-inverse bg-accent-primary no-underline"
            >
              Start Route →
            </a>
          )}
        </div>
      </div>

      {/* Stop list with route line */}
      <div className="py-2 px-4">
        {stops.map((stop, i) => {
          const status = STATUS_STYLES[stop.status] || STATUS_STYLES.pending;
          const isExpanded = expandedStop === stop.bookingId;
          const isLast = i === stops.length - 1;

          return (
            <div key={stop.bookingId} className="flex gap-3">
              {/* Route line + stop number */}
              <div className="flex flex-col items-center w-8 shrink-0">
                <div
                  className="w-7 h-7 rounded-full text-text-inverse flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: stop.status === 'completed' ? 'var(--color-status-success-fill)' : 'var(--color-accent-primary)',
                  }}
                >
                  {stop.status === 'completed' ? '✓' : stop.stopNumber}
                </div>
                {!isLast && (
                  <div className="w-0.5 flex-1 min-h-[40px] bg-border-default" />
                )}
              </div>

              {/* Stop card */}
              <button
                type="button"
                onClick={() => setExpandedStop(isExpanded ? null : stop.bookingId)}
                className="flex-1 text-left border border-border-default rounded-xl p-3 mb-2 cursor-pointer transition-colors"
                style={{
                  backgroundColor: stop.status === 'completed' ? 'var(--color-status-success-bg)' : 'var(--color-surface-primary)',
                }}
                onMouseEnter={(e) => { if (stop.status !== 'completed') (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-secondary)'; }}
                onMouseLeave={(e) => { if (stop.status !== 'completed') (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-primary)'; }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-text-primary">
                      {formatTime(stop.startAt)} – {formatTime(stop.endAt)}
                    </div>
                    <div className="text-sm text-text-secondary mt-0.5">
                      {stop.clientName} · {formatServiceName(stop.service)}
                    </div>
                    {stop.pets && (
                      <div className="text-xs text-text-tertiary mt-0.5">
                        🐾 {stop.pets}
                      </div>
                    )}
                  </div>
                  <span
                    className="rounded-xl text-xs font-semibold"
                    style={{
                      backgroundColor: status.bg, color: status.text,
                      padding: '2px var(--spacing-2)',
                    }}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 border-t border-border-default pt-3">
                    {stop.address && (
                      <p className="text-sm text-text-secondary mb-2">
                        📍 {stop.address}
                      </p>
                    )}
                    {stop.notes && (
                      <p className="text-sm text-text-tertiary italic mb-2">
                        {stop.notes}
                      </p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {stop.googleMapsUrl && (
                        <a
                          href={stop.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="min-h-[44px] inline-flex items-center px-3 py-2 rounded-lg border border-border-default text-sm font-medium text-text-primary no-underline"
                        >
                          Navigate →
                        </a>
                      )}
                      <a
                        href={`/sitter/bookings/${stop.bookingId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="min-h-[44px] inline-flex items-center px-3 py-2 rounded-lg border border-border-default text-sm font-medium text-text-primary no-underline"
                      >
                        View Booking
                      </a>
                    </div>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
