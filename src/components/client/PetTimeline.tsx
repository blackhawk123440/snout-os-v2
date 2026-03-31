'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Heart, FileText, Calendar, Camera } from 'lucide-react';
import { AppErrorState } from '@/components/app/AppErrorState';

interface TimelineItem {
  id: string;
  type: 'visit_card' | 'visit_report' | 'health_log' | 'status_change';
  date: string;
  title: string;
  summary: string;
  photoUrl?: string;
  bookingId?: string;
  metadata: Record<string, any>;
}

interface TimelineData {
  items: TimelineItem[];
  nextCursor: string | null;
  petName: string;
}

const TYPE_CONFIG: Record<string, { icon: typeof Heart; color: string; bg: string }> = {
  visit_card: { icon: Camera, color: 'text-status-success-text', bg: 'bg-status-success-bg' },
  visit_report: { icon: FileText, color: 'text-status-info-text', bg: 'bg-status-info-bg' },
  health_log: { icon: Heart, color: 'text-status-purple-text', bg: 'bg-status-purple-bg' },
  status_change: { icon: Calendar, color: 'text-text-tertiary', bg: 'bg-surface-tertiary' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export interface PetTimelineProps {
  petId: string;
  petName: string;
}

export function PetTimeline({ petId, petName }: PetTimelineProps) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (c: string | null, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/client/pets/${petId}/timeline${c ? `?cursor=${encodeURIComponent(c)}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load timeline');
      const data: TimelineData = await res.json();
      setItems(prev => append ? [...prev, ...data.items] : data.items);
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    void fetchPage(null, false);
  }, [fetchPage]);

  // Infinite scroll
  useEffect(() => {
    if (!observerRef.current || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading && cursor) {
          void fetchPage(cursor, true);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, cursor, fetchPage]);

  if (error && items.length === 0) {
    return <AppErrorState message="Couldn't load timeline" onRetry={() => void fetchPage(null, false)} />;
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-surface-primary px-8 py-12 text-center">
        <Heart className="h-8 w-8 text-text-disabled mb-3" />
        <p className="text-sm font-medium text-text-primary">No visits yet</p>
        <p className="mt-1 text-xs text-text-tertiary">
          {petName}&apos;s care history will appear here after their first visit.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.status_change;
        const Icon = config.icon;
        const isClickable = item.type === 'visit_card' && item.bookingId;

        const card = (
          <div
            className={`flex gap-3 rounded-xl border border-border-default bg-surface-primary p-3 transition ${
              isClickable ? 'hover:bg-surface-secondary cursor-pointer' : ''
            }`}
          >
            {/* Photo or icon */}
            {item.photoUrl ? (
              <img
                src={item.photoUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
                loading="lazy"
              />
            ) : (
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
                <span className="text-[11px] text-text-tertiary whitespace-nowrap">{formatDate(item.date)}</span>
              </div>
              {item.summary && (
                <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">{item.summary}</p>
              )}
              {item.type === 'visit_card' && item.metadata?.durationMinutes && (
                <span className="mt-1 inline-block rounded-full bg-accent-tertiary px-2 py-0.5 text-[10px] font-medium text-accent-primary">
                  {item.metadata.durationMinutes} min
                </span>
              )}
            </div>
          </div>
        );

        if (isClickable && item.bookingId) {
          return (
            <Link key={item.id} href={`/client/visits/${item.bookingId}`}>
              {card}
            </Link>
          );
        }

        return <div key={item.id}>{card}</div>;
      })}

      {/* Infinite scroll sentinel */}
      <div ref={observerRef} className="h-4" />

      {loading && items.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
