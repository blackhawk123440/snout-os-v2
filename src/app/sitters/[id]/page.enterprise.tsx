'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { OwnerAppShell, LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { AppErrorState, getStatusPill } from '@/components/app';
import {
  Button,
  DataTableShell,
  DropdownMenu,
  DropdownMenuItem,
  EmptyState,
  Modal,
  StatusChip,
  Table,
  TableSkeleton,
  Textarea,
} from '@/components/ui';
import { toastSuccess, toastError } from '@/lib/toast';
import { Check, AlertTriangle } from 'lucide-react';

type Booking = {
  id: string;
  firstName: string;
  lastName: string;
  service: string;
  startAt: string;
  endAt: string;
  status: string;
  totalPrice: number;
};

type Dashboard = {
  pendingRequests?: Booking[];
  upcomingBookings?: Booking[];
  completedBookings?: Booking[];
  stats?: { totalBookings?: number; completedBookings?: number; totalEarnings?: number; upcomingCount?: number };
  tierSummary?: {
    currentTier?: { name: string; id?: string; assignedAt?: string } | null;
    metrics?: {
      avgResponseSeconds?: number | null;
      offerAcceptRate?: number | null;
      offerDeclineRate?: number | null;
      offerExpireRate?: number | null;
    } | null;
  } | null;
};

type Sitter = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
  commissionPercentage?: number;
  currentTierId?: string | null;
  currentTier?: { id: string; name: string } | null;
  googleRefreshToken?: string | null;
  googleCalendarSyncEnabled?: boolean;
  onboardingStatus?: string;
  stripeAccountId?: string | null;
};

type CalendarStatus = {
  status: {
    connected: boolean;
    syncEnabled: boolean;
    calendarId?: string;
    calendarName?: string;
    lastSyncAt?: string | null;
  };
};

type PerformanceData = {
  currentTier?: { name: string; id?: string; assignedAt?: string } | null;
  metrics?: {
    avgResponseSeconds?: number | null;
    offerAcceptRate?: number | null;
    offerDeclineRate?: number | null;
    offerExpireRate?: number | null;
    lastUpdated?: string;
  } | null;
};

type ActivityEvent = {
  id: string;
  eventType: string;
  bookingId?: string | null;
  createdAt: string;
};

export default function SitterDetailEnterprisePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const sitterId = params.id;

  const { data, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['owner', 'sitters', sitterId],
    queryFn: async () => {
      const [sitterRes, dashRes] = await Promise.all([
        fetch(`/api/sitters/${sitterId}`),
        fetch(`/api/sitters/${sitterId}/dashboard`),
      ]);
      const sitterJson = await sitterRes.json().catch(() => ({}));
      const dashJson = await dashRes.json().catch(() => ({}));
      if (!sitterRes.ok) throw new Error(sitterJson.error || 'Failed to load sitter');
      if (!dashRes.ok) throw new Error(dashJson.error || 'Failed to load sitter dashboard');
      return { sitter: (sitterJson.sitter || null) as Sitter | null, dashboard: (dashJson || null) as Dashboard | null };
    },
    enabled: !!sitterId,
  });

  const { data: perfData } = useQuery<PerformanceData | null>({
    queryKey: ['owner', 'sitters', sitterId, 'performance'],
    queryFn: async () => {
      const res = await fetch(`/api/sitters/${sitterId}/tier/summary`);
      return res.ok ? res.json() : null;
    },
    enabled: !!sitterId,
  });

  const { data: calendarData } = useQuery<CalendarStatus | null>({
    queryKey: ['owner', 'sitters', sitterId, 'calendar'],
    queryFn: async () => {
      const res = await fetch(`/api/sitters/${sitterId}/calendar`);
      return res.ok ? res.json() : null;
    },
    enabled: !!sitterId,
  });

  const { data: activityData } = useQuery<ActivityEvent[] | null>({
    queryKey: ['owner', 'sitters', sitterId, 'activity'],
    queryFn: async () => {
      const res = await fetch(`/api/sitters/${sitterId}/activity`);
      return res.ok ? res.json() : null;
    },
    enabled: !!sitterId,
  });

  const sitter = data?.sitter ?? null;
  const dashboard = data?.dashboard ?? null;
  const queryClient = useQueryClient();

  // Review state
  const [reviewLoading, setReviewLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const isPendingReview = sitter?.onboardingStatus === 'pending_review';

  async function handleApprove() {
    if (!sitter) return;
    setReviewLoading(true);
    try {
      const res = await fetch(`/api/sitters/${sitter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingStatus: 'active', isActive: true }),
      });
      if (!res.ok) throw new Error('Failed to approve');
      toastSuccess('Sitter approved and activated');
      queryClient.invalidateQueries({ queryKey: ['owner', 'sitters', sitterId] });
    } catch (err: any) {
      toastError(err.message || 'Failed to approve sitter');
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleReject() {
    if (!sitter || !rejectReason.trim()) return;
    setReviewLoading(true);
    try {
      const res = await fetch(`/api/sitters/${sitter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingStatus: 'rejected', isActive: false }),
      });
      if (!res.ok) throw new Error('Failed to reject');
      toastSuccess('Sitter rejected');
      setShowRejectModal(false);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['owner', 'sitters', sitterId] });
    } catch (err: any) {
      toastError(err.message || 'Failed to reject sitter');
    } finally {
      setReviewLoading(false);
    }
  }

  const nextBooking = useMemo(
    () =>
      dashboard?.upcomingBookings
        ?.slice()
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0],
    [dashboard]
  );

  // Derive tier name from performance data, dashboard tierSummary, or sitter.currentTier
  const tierName =
    perfData?.currentTier?.name ||
    dashboard?.tierSummary?.currentTier?.name ||
    sitter?.currentTier?.name ||
    'Unassigned';

  // Derive performance metrics — prefer perfData, fall back to dashboard tierSummary
  const metrics = perfData?.metrics || dashboard?.tierSummary?.metrics || null;

  const offerAcceptDisplay =
    metrics?.offerAcceptRate != null
      ? `${Math.round(metrics.offerAcceptRate * 100)}%`
      : 'N/A';

  const responseTimeDisplay =
    metrics?.avgResponseSeconds != null
      ? `${Math.round(metrics.avgResponseSeconds / 60)} min`
      : 'N/A';

  // Calendar connection status
  const calendarConnected = calendarData?.status?.connected ?? false;

  if (loading) {
    return (
      <OwnerAppShell>
        <LayoutWrapper variant="wide">
          <PageHeader title="Sitter" subtitle="Loading..." />
          <TableSkeleton rows={7} cols={5} />
        </LayoutWrapper>
      </OwnerAppShell>
    );
  }
  if (queryError || !sitter) {
    return (
      <OwnerAppShell>
        <LayoutWrapper variant="wide">
          <PageHeader title="Sitter" subtitle="Unable to load sitter" />
          <AppErrorState title="Couldn't load sitter" onRetry={() => void refetch()} />
        </LayoutWrapper>
      </OwnerAppShell>
    );
  }

  const bookings = dashboard?.upcomingBookings || [];
  const completed = dashboard?.completedBookings || [];
  const stats = dashboard?.stats || {};

  return (
    <OwnerAppShell>
      <LayoutWrapper variant="wide">
        <PageHeader
          title={`${sitter.firstName} ${sitter.lastName}`}
          subtitle={sitter.isActive ? 'Active sitter' : 'Inactive sitter'}
          actions={
            <div className="flex gap-2">
              <Link href="/sitters"><Button variant="secondary">Back</Button></Link>
              <Link href="/bookings/new"><Button>New booking</Button></Link>
              {sitter.phone ? <a href={`tel:${sitter.phone}`}><Button variant="secondary">Call</Button></a> : null}
              <Link href={`/ops/payouts?sitterId=${sitter.id}`}><Button variant="secondary">View payouts</Button></Link>
              <DropdownMenu
                trigger={<Button variant="secondary">...</Button>}
              >
                <DropdownMenuItem
                  onClick={() => router.push(`/ops/calendar-repair?sitterId=${sitter.id}`)}
                >
                  Repair calendar
                </DropdownMenuItem>
              </DropdownMenu>
            </div>
          }
        />

        {/* Review banner for pending sitters */}
        {isPendingReview && (
          <div className="rounded-2xl border border-status-warning-border bg-status-warning-bg p-5 mb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-status-warning-text shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-status-warning-text">Ready for review</p>
                  <p className="text-sm text-status-warning-text mt-0.5">{sitter.firstName} completed onboarding and is waiting for approval.</p>
                  <div className="mt-3 flex flex-col gap-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-status-success-text" />
                      <span className="text-text-primary">Password set</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {calendarData?.status?.connected ? (
                        <><Check className="h-3.5 w-3.5 text-status-success-text" /><span className="text-text-primary">Calendar connected</span></>
                      ) : (
                        <><AlertTriangle className="h-3.5 w-3.5 text-status-warning-text" /><span className="text-text-secondary">Calendar not connected</span></>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {sitter.stripeAccountId ? (
                        <><Check className="h-3.5 w-3.5 text-status-success-text" /><span className="text-text-primary">Stripe connected</span></>
                      ) : (
                        <><AlertTriangle className="h-3.5 w-3.5 text-status-warning-text" /><span className="text-text-secondary">Stripe not connected — payouts will be held</span></>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="danger" size="sm" onClick={() => setShowRejectModal(true)} disabled={reviewLoading}>
                  Reject
                </Button>
                <Button variant="primary" size="sm" onClick={handleApprove} disabled={reviewLoading}>
                  {reviewLoading ? 'Saving...' : 'Approve'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Reject confirmation modal */}
        <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title={`Reject ${sitter?.firstName} ${sitter?.lastName}?`}>
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">They will be notified that their application was not approved.</p>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Reason (required)</label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why is this sitter being rejected?" rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowRejectModal(false)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={handleReject} disabled={reviewLoading || !rejectReason.trim()}>
                {reviewLoading ? 'Rejecting...' : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        </Modal>

        <Section title="At a Glance">
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-5">
            <div className="rounded-lg border border-border-default bg-surface-primary p-3"><div className="text-xs text-text-secondary">Next booking</div><div className="mt-0.5 text-sm font-medium text-text-primary">{nextBooking ? new Date(nextBooking.startAt).toLocaleString() : 'None'}</div></div>
            <div className="rounded-lg border border-border-default bg-surface-primary p-3"><div className="text-xs text-text-secondary">Last completed</div><div className="mt-0.5 text-sm font-medium text-text-primary">{completed[0] ? new Date(completed[0].endAt).toLocaleDateString() : 'None'}</div></div>
            <div className="rounded-lg border border-border-default bg-surface-primary p-3"><div className="text-xs text-text-secondary">Total bookings</div><div className="mt-0.5 text-sm font-medium text-text-primary">{stats.totalBookings || 0}</div></div>
            <div className="rounded-lg border border-border-default bg-surface-primary p-3"><div className="text-xs text-text-secondary">Earnings</div><div className="mt-0.5 text-sm font-medium text-text-primary">${Number(stats.totalEarnings || 0).toFixed(2)}</div></div>
            <div className="rounded-lg border border-border-default bg-surface-primary p-3"><div className="text-xs text-text-secondary">Status</div><div className="mt-0.5"><StatusChip variant={sitter.isActive ? 'success' : 'warning'}>{sitter.isActive ? 'Active' : 'Inactive'}</StatusChip></div></div>
            <div className="rounded-lg border border-border-default bg-surface-primary p-3"><div className="text-xs text-text-secondary">Tier</div><div className="mt-0.5 text-sm font-medium text-text-primary">{tierName}</div></div>
            <div className="rounded-lg border border-border-default bg-surface-primary p-3"><div className="text-xs text-text-secondary">Service Score</div><div className="mt-0.5 text-sm font-medium text-text-primary">{offerAcceptDisplay}</div></div>
            <div className="rounded-lg border border-border-default bg-surface-primary p-3"><div className="text-xs text-text-secondary">Response Time</div><div className="mt-0.5 text-sm font-medium text-text-primary">{responseTimeDisplay}</div></div>
            <div className="rounded-lg border border-border-default bg-surface-primary p-3">
              <div className="text-xs text-text-secondary">Calendar</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-text-primary">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${calendarConnected ? 'bg-status-success-fill' : 'bg-surface-tertiary'}`}
                />
                {calendarConnected ? 'Connected' : 'Not connected'}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Availability">
          <EmptyState title="No availability set" description="This sitter has not configured availability rules yet." />
        </Section>

        <Section title="Recent Activity">
          {activityData && activityData.length > 0 ? (
            <div className="divide-y divide-border-muted">
              {activityData.slice(0, 10).map((event) => (
                <div key={event.id} className="flex items-center gap-4 py-2 text-sm">
                  <span className="text-text-secondary">{new Date(event.createdAt).toLocaleDateString()}</span>
                  <span className="text-text-primary font-medium">{event.eventType}</span>
                  {event.bookingId && (
                    <Link href={`/bookings/${event.bookingId}`} className="text-text-link hover:underline">
                      {event.bookingId.slice(0, 8)}...
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No recent activity" description="Activity events for this sitter will appear here." />
          )}
        </Section>

        <Section title="Upcoming Bookings">
          {bookings.length === 0 ? (
            <EmptyState title="No upcoming bookings" description="Assign this sitter to upcoming work from bookings." />
          ) : (
            <DataTableShell stickyHeader>
              <Table<Booking>
                forceTableLayout
                columns={[
                  { key: 'client', header: 'Client', mobileOrder: 1, mobileLabel: 'Client', render: (r) => `${r.firstName} ${r.lastName}` },
                  { key: 'service', header: 'Service', mobileOrder: 2, mobileLabel: 'Service' },
                  { key: 'startAt', header: 'Start', mobileOrder: 3, mobileLabel: 'Start', render: (r) => new Date(r.startAt).toLocaleString() },
                  { key: 'status', header: 'Status', mobileOrder: 4, mobileLabel: 'Status', render: (r) => <StatusChip>{getStatusPill(r.status).label}</StatusChip> },
                  { key: 'total', header: 'Total', mobileOrder: 5, mobileLabel: 'Total', align: 'right', render: (r) => `$${r.totalPrice.toFixed(2)}` },
                ]}
                data={bookings}
                keyExtractor={(r) => r.id}
                onRowClick={(r) => router.push(`/bookings/${r.id}`)}
                emptyMessage="No upcoming bookings"
              />
            </DataTableShell>
          )}
        </Section>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}
