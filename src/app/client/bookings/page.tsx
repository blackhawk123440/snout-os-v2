'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Plus, ChevronRight, MessageSquare } from 'lucide-react';
import { LayoutWrapper, ClientRefreshButton } from '@/components/layout';
import { AppErrorState } from '@/components/app';
import { Button } from '@/components/ui';
import { statusDotClass, statusLabel } from '@/lib/status-colors';
import { formatServiceName } from '@/lib/format-utils';
import { useClientBookings, type ClientBooking } from '@/lib/api/client-hooks';

const pageSize = 20;
type TabFilter = 'All' | 'Upcoming' | 'Past';

export default function ClientBookingsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [displayed, setDisplayed] = useState<ClientBooking[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>('All');

  const { data, isLoading, isFetching, error, refetch } = useClientBookings(page, pageSize);

  useEffect(() => {
    if (!data) return;
    if (page === 1) {
      setDisplayed(data.items);
    } else {
      setDisplayed((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        const newItems = data.items.filter((b) => !existingIds.has(b.id));
        return [...prev, ...newItems];
      });
    }
  }, [data, page]);

  const total = data?.total ?? 0;
  const loading = isLoading && page === 1;
  const loadingMore = isFetching && page > 1;

  const handleRefresh = () => {
    setPage(1);
    refetch();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const allBookings = displayed;
  const upcomingCount = allBookings.filter(b => !['completed', 'cancelled', 'no_show'].includes(b.status.toLowerCase())).length;
  const pastCount = allBookings.filter(b => ['completed', 'cancelled', 'no_show'].includes(b.status.toLowerCase())).length;

  const filtered = displayed.filter((b) => {
    if (activeTab === 'All') return true;
    const isPast = ['completed', 'cancelled', 'no_show'].includes(b.status.toLowerCase());
    return activeTab === 'Past' ? isPast : !isPast;
  });

  const tabCounts: Record<TabFilter, number | null> = {
    All: total || allBookings.length,
    Upcoming: upcomingCount,
    Past: pastCount,
  };

  return (
    <LayoutWrapper variant="narrow">
      <ClientBookingsHero
        total={total || allBookings.length}
        upcomingCount={upcomingCount}
        pastCount={pastCount}
      />

      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text-primary font-heading leading-tight sm:text-2xl">
            Your visits
          </h1>
          <p className="text-[14px] text-text-secondary mt-0.5">
            {displayed.length > 0
              ? `${total} booking${total !== 1 ? 's' : ''}`
              : 'Upcoming and past bookings'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ClientRefreshButton onRefresh={handleRefresh} loading={loading} />
          <Link href="/client/bookings/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>Book</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <BookingsSkeleton />
      ) : error ? (
        <AppErrorState title="Couldn't load bookings" subtitle={error.message || 'Unable to load bookings'} onRetry={handleRefresh} />
      ) : displayed.length === 0 ? (
        <div className="rounded-3xl bg-accent-tertiary p-8 text-center mt-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary shadow-sm mb-4">
            <Calendar className="h-7 w-7 text-text-inverse" />
          </div>
          <p className="text-xl font-bold text-text-primary">No visits yet</p>
          <p className="mt-2 text-sm text-text-secondary max-w-[280px] mx-auto leading-relaxed">
            Book your first visit and your care team will take it from request to report in one place.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/client/bookings/new">
              <Button variant="primary" size="md">Book a visit</Button>
            </Link>
            <Link href="/client/meet-greet">
              <Button variant="secondary" size="md">Meet &amp; greet</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4 mt-4">
          {/* Filter tabs with counts */}
          <div className="inline-flex rounded-2xl bg-surface-secondary p-1">
            {(['All', 'Upcoming', 'Past'] as TabFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-2 text-[13px] font-semibold min-h-[44px] transition-all flex items-center gap-1.5 ${
                  activeTab === tab
                    ? 'bg-surface-primary shadow-sm text-text-primary'
                    : 'text-text-tertiary hover:text-text-primary'
                }`}
              >
                {tab}
                {tabCounts[tab] != null && tabCounts[tab]! > 0 && (
                  <span className={`text-[11px] tabular-nums ${activeTab === tab ? 'text-text-secondary' : 'text-text-disabled'}`}>
                    {tabCounts[tab]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Booking list */}
          <div className="rounded-2xl bg-surface-primary shadow-sm overflow-hidden">
            <div className="divide-y divide-border-muted">
              {filtered.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-[14px] text-text-tertiary">No {activeTab.toLowerCase()} bookings</p>
                </div>
              ) : filtered.map((booking) => {
                const isCompleted = ['completed', 'cancelled', 'no_show'].includes(booking.status.toLowerCase());
                return (
                  <div
                    key={booking.id}
                    className={`flex items-center gap-3 px-5 py-4 min-h-[72px] cursor-pointer hover:bg-surface-secondary transition-colors ${isCompleted ? 'opacity-50' : ''}`}
                    onClick={() => router.push(`/client/bookings/${booking.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && router.push(`/client/bookings/${booking.id}`)}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-tertiary text-sm font-bold text-accent-primary">
                      {booking.service?.[0] || 'V'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-text-primary truncate">{formatServiceName(booking.service)}</p>
                      <p className="text-[12px] text-text-secondary tabular-nums mt-0.5">
                        {formatDate(booking.startAt)} {'\u00b7'} {formatTime(booking.startAt)}
                        {booking.sitter?.name ? ` \u00b7 ${booking.sitter.name}` : ''}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`h-2 w-2 rounded-full ${statusDotClass(booking.status)}`} />
                        <span className="text-[11px] font-medium text-text-tertiary">{statusLabel(booking.status)}</span>
                      </div>
                    </div>
                    <Link
                      href={booking.threadId ? `/client/messages/${booking.threadId}` : '/client/messages'}
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-tertiary hover:bg-accent-tertiary hover:text-accent-primary transition"
                      aria-label={booking.threadId ? 'Message sitter' : 'Contact us'}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Link>
                    <ChevronRight className="h-4 w-4 text-text-disabled shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>

          {displayed.length < total && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setPage((p) => p + 1)}
                disabled={loadingMore}
                isLoading={loadingMore}
              >
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </LayoutWrapper>
  );
}

function ClientBookingsHero({
  total,
  upcomingCount,
  pastCount,
}: {
  total: number;
  upcomingCount: number;
  pastCount: number;
}) {
  return (
    <div className="rounded-3xl border border-border-default bg-surface-primary p-5 shadow-sm mb-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="inline-flex rounded-full bg-accent-tertiary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-primary">
          Visit history
        </span>
      </div>
      <h2 className="text-xl font-bold text-text-primary">Track every request, visit, and follow-up</h2>
      <p className="mt-2 text-sm text-text-secondary">
        Your booking history stays here so you can quickly see what&apos;s coming up, what&apos;s finished, and where to message or rebook.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border-default bg-surface-secondary p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Total</p>
          <p className="mt-1 text-lg font-bold text-text-primary tabular-nums">{total}</p>
        </div>
        <div className="rounded-2xl border border-border-default bg-surface-secondary p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Upcoming</p>
          <p className="mt-1 text-lg font-bold text-text-primary tabular-nums">{upcomingCount}</p>
        </div>
        <div className="rounded-2xl border border-border-default bg-surface-secondary p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Past</p>
          <p className="mt-1 text-lg font-bold text-text-primary tabular-nums">{pastCount}</p>
        </div>
      </div>
    </div>
  );
}

function BookingsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse mt-4">
      <div className="h-10 w-56 rounded-2xl bg-surface-tertiary" />
      <div className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3.5">
            <div className="h-11 w-11 rounded-2xl bg-surface-tertiary shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 rounded bg-surface-tertiary" />
              <div className="h-3 w-48 rounded bg-surface-tertiary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
