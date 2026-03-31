'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button, Tabs } from '@/components/ui';
import {
  SitterCard,
  SitterCardHeader,
  SitterCardBody,
  SitterCardActions,
  SitterPageHeader,
  SitterSkeletonList,
  SitterEmptyState,
  SitterErrorState,
} from '@/components/sitter';
import { statusBadgeClass, statusLabel } from '@/lib/status-colors';
import { formatServiceName } from '@/lib/format-utils';
import { MapPin, Clock } from 'lucide-react';

type TabId = 'active' | 'upcoming' | 'completed';

interface Booking {
  id: string;
  status: string;
  service: string;
  startAt: string;
  endAt: string;
  address: string | null;
  clientName: string;
  pets: Array<{ id: string; name?: string | null; species?: string | null }>;
  threadId?: string | null;
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const formatTime = (d: string) =>
  new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function SitterBookingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('active');

  const { data: bookings = [], isLoading: loading, error: queryError, refetch } = useQuery<Booking[]>({
    queryKey: ['sitter', 'bookings-tabbed'],
    queryFn: async () => {
      const [todayRes, calRes] = await Promise.all([
        fetch('/api/sitter/today'),
        fetch('/api/sitter/calendar'),
      ]);
      const todayData = await todayRes.json().catch(() => { console.warn('Failed to load /api/sitter/today'); return {}; });
      const calData = await calRes.json().catch(() => { console.warn('Failed to load /api/sitter/calendar'); return {}; });
      const todayFailed = !todayData.bookings;
      const calFailed = !calData.bookings;
      if (todayFailed && calFailed) {
        throw new Error('Failed to load sitter bookings');
      }
      const today = Array.isArray(todayData.bookings) ? todayData.bookings : [];
      const upcoming = Array.isArray(calData.bookings) ? calData.bookings : [];
      return [...today, ...upcoming.filter((b: Booking) => !today.some((t: Booking) => t.id === b.id))];
    },
  });
  const error = queryError?.message || null;

  const now = new Date().toISOString();
  const active = bookings
    .filter((b) => ['pending', 'confirmed', 'in_progress'].includes(b.status))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const upcoming = bookings
    .filter((b) => ['pending', 'confirmed'].includes(b.status) && b.startAt >= now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const completed = bookings
    .filter((b) => b.status === 'completed')
    .sort((a, b) => b.startAt.localeCompare(a.startAt));

  const renderBookingCard = (booking: Booking) => {
    const petNames = booking.pets
      ?.filter((p) => p.name)
      .map((p) => p.name)
      .join(', ');

    return (
      <SitterCard key={booking.id} onClick={() => router.push(`/sitter/bookings/${booking.id}`)}>
        <SitterCardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text-primary truncate">{booking.clientName}</p>
              <p className="text-sm text-text-secondary">{formatServiceName(booking.service)}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(booking.status)}`}>
              {statusLabel(booking.status)}
            </span>
          </div>
        </SitterCardHeader>
        <SitterCardBody>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Clock className="h-3.5 w-3.5 text-text-disabled shrink-0" />
              <span className="tabular-nums">{formatDate(booking.startAt)} · {formatTime(booking.startAt)} – {formatTime(booking.endAt)}</span>
            </div>
            {booking.address && (
              <div className="flex items-center gap-2 text-xs text-text-tertiary">
                <MapPin className="h-3.5 w-3.5 text-text-disabled shrink-0" />
                <span className="truncate">{booking.address}</span>
              </div>
            )}
            {petNames && (
              <p className="text-xs text-text-tertiary">
                Pets: {petNames}
              </p>
            )}
          </div>
        </SitterCardBody>
        <SitterCardActions stopPropagation>
          <Button variant="secondary" size="sm" onClick={() => router.push(`/sitter/bookings/${booking.id}`)}>
            Details
          </Button>
          {booking.threadId && (
            <Button variant="secondary" size="sm" onClick={() => router.push(`/sitter/inbox?thread=${booking.threadId}`)}>
              Message
            </Button>
          )}
        </SitterCardActions>
      </SitterCard>
    );
  };

  const currentList = activeTab === 'active' ? active : activeTab === 'upcoming' ? upcoming : completed;
  const emptyConfig: { title: string; subtitle: string; cta?: { label: string; onClick: () => void } } = {
    active: { title: 'No active bookings', subtitle: 'Check Calendar for upcoming visits.', cta: { label: 'Open Calendar', onClick: () => router.push('/sitter/calendar') } },
    upcoming: { title: 'No upcoming bookings', subtitle: 'New bookings will appear here.' },
    completed: { title: 'No completed bookings yet', subtitle: 'Finished visits will show up here.' },
  }[activeTab];

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <SitterPageHeader
        title="Bookings"
        subtitle="Active, upcoming, and completed"
        action={
          <Button variant="secondary" size="sm" onClick={() => void refetch()} disabled={loading}>
            Refresh
          </Button>
        }
      />
      <Tabs
        tabs={[
          { id: 'active', label: `Active${!loading && active.length ? ` (${active.length})` : ''}` },
          { id: 'upcoming', label: `Upcoming${!loading && upcoming.length ? ` (${upcoming.length})` : ''}` },
          { id: 'completed', label: `Completed${!loading && completed.length ? ` (${completed.length})` : ''}` },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
      >
        {loading ? (
          <div className="mt-4">
            <SitterSkeletonList count={3} />
          </div>
        ) : error ? (
          <div className="mt-4">
            <SitterErrorState title="Couldn't load bookings" subtitle={error} onRetry={() => void refetch()} />
          </div>
        ) : currentList.length === 0 ? (
          <div className="mt-4">
            <SitterEmptyState
              title={emptyConfig.title}
              subtitle={emptyConfig.subtitle}
              cta={emptyConfig.cta}
            />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {currentList.map(renderBookingCard)}
          </div>
        )}
      </Tabs>
    </div>
  );
}
