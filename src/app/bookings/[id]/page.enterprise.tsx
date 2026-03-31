'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Phone, Mail, MessageSquare, ExternalLink } from 'lucide-react';
import { OwnerAppShell, LayoutWrapper, PageHeader } from '@/components/layout';
import { AppErrorState, getStatusPill } from '@/components/app';
import {
  Button,
  DataTableShell,
  EmptyState,
  Input,
  Modal,
  Select,
  StatusChip,
  Table,
  TableSkeleton,
  useToast,
} from '@/components/ui';
import { formatServiceName, formatDateTime, formatDate, formatTime, formatDuration, formatLabel } from '@/lib/format-utils';

type Booking = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  service: string;
  startAt: string;
  endAt: string;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  notes?: string | null;
  threadId: string | null;
  sitter?: { id: string; firstName: string; lastName: string } | null;
  client?: { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null } | null;
  pets?: Array<{ id: string; name: string; species: string }>;
  timeSlots?: Array<{ id: string; startAt: string; endAt: string; duration: number }>;
  hasReport?: boolean;
  paymentProof?: {
    status: string;
    amount: number;
    paidAt: string;
    bookingReference: string;
    paymentReference: string;
    paymentIntentId: string | null;
    currency: string;
    receiptLink: string | null;
    inferred?: boolean;
  } | null;
  calendarSyncProof?: {
    status: string;
    externalEventId: string | null;
    connectedCalendar: string | null;
    connectedAccount: string | null;
    lastSyncedAt: string | null;
    syncError: string | null;
    openInGoogleCalendarUrl: string | null;
  } | null;
  paymentMessageState?: {
    status: string;
    sentAt: string;
    providerMessageId: string | null;
    error: string | null;
  } | null;
  tipMessageState?: {
    status: string;
    sentAt: string;
    providerMessageId: string | null;
    error: string | null;
  } | null;
};

type EventItem = {
  id: string;
  type: string;
  source: 'event' | 'status';
  status?: string | null;
  message: string;
  createdAt: string;
};

export default function BookingDetailEnterprisePage() {
  const params = useParams<{ id: string }>();
  const bookingId = params.id;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [sitterId, setSitterId] = useState('');
  const [smartMatches, setSmartMatches] = useState<Array<{ sitterId: string; sitterName: string; score: number; breakdown: Record<string, number> }> | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const { data: pageData, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['owner', 'bookings', bookingId],
    queryFn: async () => {
      const [bookingRes, eventsRes, sittersRes] = await Promise.all([
        fetch(`/api/bookings/${bookingId}`),
        fetch(`/api/bookings/${bookingId}/events`),
        fetch('/api/sitters?page=1&pageSize=200'),
      ]);
      const bookingJson = await bookingRes.json().catch(() => ({}));
      const eventsJson = await eventsRes.json().catch(() => ({}));
      const sittersJson = await sittersRes.json().catch(() => ({}));
      if (!bookingRes.ok) throw new Error(bookingJson.error || 'Failed to load booking');
      if (!eventsRes.ok) throw new Error(eventsJson.error || 'Failed to load events');
      return {
        booking: (bookingJson.booking || null) as Booking | null,
        events: (Array.isArray(eventsJson.items) ? eventsJson.items : []) as EventItem[],
        sitters: (Array.isArray(sittersJson.items) ? sittersJson.items : []) as Array<{ id: string; firstName: string; lastName: string }>,
      };
    },
    enabled: !!bookingId,
  });

  const booking = pageData?.booking ?? null;
  const events = pageData?.events ?? [];
  const sitters = pageData?.sitters ?? [];
  const error = queryError ? queryError.message : null;

  const currentSitterId = booking?.sitter?.id || '';
  useEffect(() => {
    if (currentSitterId) setSitterId(currentSitterId);
  }, [currentSitterId]);

  const filteredEvents = useMemo(() => {
    if (eventTypeFilter === 'all') return events;
    return events.filter((e) => e.type.toLowerCase().includes(eventTypeFilter.toLowerCase()));
  }, [events, eventTypeFilter]);

  const paymentProof = booking?.paymentProof ?? null;
  const calendarProof = booking?.calendarSyncProof ?? null;

  // ── Mutations ──
  const patchBookingMutation = useMutation({
    mutationFn: async ({ payload, successMessage }: { payload: Record<string, unknown>; successMessage: string }) => {
      const res = await fetch(`/api/bookings/${bookingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Update failed');
      return { successMessage };
    },
    onSuccess: ({ successMessage }) => { showToast({ variant: 'success', message: successMessage }); void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings', bookingId] }); },
    onError: (err: Error) => showToast({ variant: 'error', message: err.message }),
  });
  const patchBooking = (payload: Record<string, unknown>, msg: string) => patchBookingMutation.mutate({ payload, successMessage: msg });

  const runFixMutation = useMutation({
    mutationFn: async (type: 'automation_failure' | 'calendar_repair') => {
      const target = events.find((e) => e.type.includes(type === 'automation_failure' ? 'automation' : 'calendar'));
      if (!target) throw new Error(`No ${type} event found`);
      const res = await fetch('/api/ops/command-center/attention/fix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: `${type}:${target.id.replace(/^event:/, '')}` }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Fix failed');
      return json;
    },
    onSuccess: () => { showToast({ variant: 'success', message: 'Fix queued' }); void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings', bookingId] }); },
    onError: (err: Error) => showToast({ variant: 'error', message: err.message }),
  });

  const sendBookingLinkMutation = useMutation({
    mutationFn: async ({ kind, forceResend = false }: { kind: 'payment' | 'tip'; forceResend?: boolean }) => {
      const endpoint = kind === 'payment' ? '/api/messages/send-payment-link' : '/api/messages/send-tip-link';
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId, forceResend }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed to send ${kind} link`);
      return { kind, deduped: json.deduped };
    },
    onSuccess: ({ kind, deduped }) => { showToast({ variant: 'success', message: deduped ? `${kind} link already sent recently` : `${kind} link sent` }); void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings', bookingId] }); },
    onError: (err: Error) => showToast({ variant: 'error', message: err.message }),
  });
  const sendLink = (kind: 'payment' | 'tip') => sendBookingLinkMutation.mutate({ kind, forceResend: !!(kind === 'payment' ? booking?.paymentMessageState : booking?.tipMessageState) });

  const busy = patchBookingMutation.isPending || runFixMutation.isPending || sendBookingLinkMutation.isPending;

  // ── Loading / Error ──
  if (loading) {
    return (<OwnerAppShell><LayoutWrapper variant="wide"><PageHeader title="Loading..." subtitle="" /><TableSkeleton rows={8} cols={5} /></LayoutWrapper></OwnerAppShell>);
  }
  if (error || !booking) {
    return (<OwnerAppShell><LayoutWrapper variant="wide"><PageHeader title="Booking" subtitle="Unable to load" /><AppErrorState title="Couldn't load booking" subtitle={error || 'Unknown error'} onRetry={() => void refetch()} /></LayoutWrapper></OwnerAppShell>);
  }

  const petList = booking.pets?.map((p) => `${p.name} (${p.species})`).join(', ') || 'None listed';

  return (
    <OwnerAppShell>
      <LayoutWrapper variant="wide">
        {/* Header */}
        <PageHeader
          title={`${booking.firstName} ${booking.lastName}`}
          subtitle={`${formatServiceName(booking.service)} \u00b7 ${formatDate(booking.startAt)} at ${formatTime(booking.startAt)} \u00b7 $${booking.totalPrice.toFixed(2)}`}
          actions={
            <div className="flex gap-2">
              <Link href="/bookings"><Button variant="secondary" size="sm">Back</Button></Link>
              {booking.client?.id && <Link href={`/clients/${booking.client.id}`}><Button variant="secondary" size="sm">View client</Button></Link>}
              {booking.sitter?.id && <Link href={`/sitters/${booking.sitter.id}`}><Button variant="secondary" size="sm">View sitter</Button></Link>}
            </div>
          }
        />

        <div className="space-y-4">
          {/* Status bar */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <div className="rounded-2xl border border-border-default bg-surface-primary p-3">
              <p className="text-xs text-text-tertiary mb-1">Status</p>
              <StatusChip ariaLabel={`Status ${getStatusPill(booking.status).label}`}>{getStatusPill(booking.status).label}</StatusChip>
            </div>
            <div className="rounded-2xl border border-border-default bg-surface-primary p-3">
              <p className="text-xs text-text-tertiary mb-1">Payment</p>
              <StatusChip ariaLabel={`Payment ${getStatusPill(booking.paymentStatus).label}`}>{getStatusPill(booking.paymentStatus).label}</StatusChip>
            </div>
            <div className="rounded-2xl border border-border-default bg-surface-primary p-3">
              <p className="text-xs text-text-tertiary mb-1">Sitter</p>
              <p className="text-sm font-medium text-text-primary">{booking.sitter ? `${booking.sitter.firstName} ${booking.sitter.lastName}` : 'Unassigned'}</p>
            </div>
            <div className="rounded-2xl border border-border-default bg-surface-primary p-3">
              <p className="text-xs text-text-tertiary mb-1">Report</p>
              <p className="text-sm font-medium text-text-primary">{booking.hasReport ? 'Submitted' : 'Not submitted'}</p>
            </div>
          </div>

          {/* Visit details */}
          <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Visit details</h3>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
              <div>
                <span className="text-text-tertiary">Client:</span>{' '}
                <span className="text-text-primary font-medium">{booking.firstName} {booking.lastName}</span>
                {booking.phone && <> &middot; <a href={`tel:${booking.phone}`} className="text-accent-primary hover:underline">{booking.phone}</a></>}
                {booking.email && <> &middot; <a href={`mailto:${booking.email}`} className="text-accent-primary hover:underline">{booking.email}</a></>}
              </div>
              <div>
                <span className="text-text-tertiary">Service:</span>{' '}
                <span className="text-text-primary">{formatServiceName(booking.service)} &middot; ${booking.totalPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-text-tertiary">Pets:</span>{' '}
                <span className="text-text-primary">{petList}</span>
              </div>
              <div>
                <span className="text-text-tertiary">Time:</span>{' '}
                <span className="text-text-primary">{formatDate(booking.startAt)}, {formatTime(booking.startAt)} &ndash; {formatTime(booking.endAt)} ({formatDuration(booking.startAt, booking.endAt)})</span>
              </div>
              {booking.address && (
                <div>
                  <span className="text-text-tertiary">Address:</span>{' '}
                  <span className="text-text-primary">{booking.address}</span>
                </div>
              )}
              {booking.pickupAddress && (
                <div>
                  <span className="text-text-tertiary">Pickup:</span>{' '}
                  <span className="text-text-primary">{booking.pickupAddress}</span>
                </div>
              )}
              {booking.dropoffAddress && (
                <div>
                  <span className="text-text-tertiary">Dropoff:</span>{' '}
                  <span className="text-text-primary">{booking.dropoffAddress}</span>
                </div>
              )}
              {booking.timeSlots && booking.timeSlots.length > 1 && (
                <div className="sm:col-span-2">
                  <span className="text-text-tertiary">Time slots:</span>{' '}
                  <span className="text-text-primary">
                    {booking.timeSlots
                      .slice(0, 5)
                      .map((slot) => `${formatDate(slot.startAt)} ${formatTime(slot.startAt)}-${formatTime(slot.endAt)}`)
                      .join(' • ')}
                    {booking.timeSlots.length > 5 ? ` • +${booking.timeSlots.length - 5} more` : ''}
                  </span>
                </div>
              )}
              {booking.notes && (
                <div className="sm:col-span-2">
                  <span className="text-text-tertiary">Notes:</span>{' '}
                  <span className="text-text-primary">{booking.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions — 2-column */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Manage */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Manage</h3>

              <p className="text-xs text-text-tertiary mb-1">Sitter assignment</p>
              <Select
                value={sitterId}
                options={[{ value: '', label: 'Unassigned' }, ...sitters.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))]}
                onChange={(e) => { setSitterId(e.target.value); setSmartMatches(null); }}
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="flex-1" disabled={busy} onClick={() => patchBooking({ sitterId: sitterId || null }, 'Sitter updated')}>Save</Button>
                <Button variant="secondary" size="sm" className="flex-1" disabled={loadingMatches} onClick={async () => {
                  setLoadingMatches(true);
                  try {
                    const res = await fetch(`/api/ops/bookings/${bookingId}/smart-assign`);
                    if (res.ok) { const data = await res.json(); setSmartMatches(data.matches || []); }
                    else showToast({ message: 'Smart assign failed', variant: 'error' });
                  } catch { showToast({ message: 'Network error', variant: 'error' }); }
                  setLoadingMatches(false);
                }}>
                  {loadingMatches ? '...' : 'Smart Assign'}
                </Button>
              </div>
              {smartMatches && smartMatches.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <p className="text-xs text-text-tertiary">Recommendations:</p>
                  {smartMatches.slice(0, 3).map((m) => (
                    <button key={m.sitterId} type="button" className="flex items-center justify-between rounded-lg border border-border-default p-2 text-left text-sm hover:bg-surface-secondary transition" onClick={() => { setSitterId(m.sitterId); setSmartMatches(null); }}>
                      <span className="font-medium">{m.sitterName}</span>
                      <span className="text-xs text-text-tertiary">Score: {m.score}</span>
                    </button>
                  ))}
                </div>
              )}
              {smartMatches && smartMatches.length === 0 && <p className="mt-2 text-xs text-text-tertiary">No available sitters for this time.</p>}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => setCancelModalOpen(true)}>Cancel booking</Button>
                <Link href={`/money?bookingId=${booking.id}`}><Button variant="secondary" size="sm">Process refund</Button></Link>
              </div>
            </div>

            {/* Communicate */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Communicate</h3>
              <div className="flex flex-col gap-2">
                {booking.paymentStatus !== 'paid' && (
                  <Button size="sm" disabled={busy} onClick={() => sendLink('payment')}>
                    {booking.paymentMessageState ? 'Resend payment link' : 'Send payment link'}
                  </Button>
                )}
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => sendLink('tip')}>
                  {booking.tipMessageState ? 'Resend tip link' : 'Send tip link'}
                </Button>
                {booking.threadId && (
                  <Link href={`/messaging?thread=${booking.threadId}`}>
                    <Button variant="secondary" size="sm" leftIcon={<MessageSquare className="w-3.5 h-3.5" />} className="w-full">Open message thread</Button>
                  </Link>
                )}
                {booking.email && (
                  <a href={`mailto:${booking.email}`}>
                    <Button variant="secondary" size="sm" leftIcon={<Mail className="w-3.5 h-3.5" />} className="w-full">Email client</Button>
                  </a>
                )}
                {booking.phone && (
                  <a href={`tel:${booking.phone}`}>
                    <Button variant="secondary" size="sm" leftIcon={<Phone className="w-3.5 h-3.5" />} className="w-full">{booking.phone}</Button>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Payment & Calendar status — collapsed */}
          <div className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden">
            <button type="button" onClick={() => setPaymentExpanded(!paymentExpanded)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-secondary transition min-h-[44px]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">Payment</span>
                <span className="text-sm text-text-secondary">
                  {paymentProof ? `Paid $${paymentProof.amount.toFixed(2)} on ${formatDate(paymentProof.paidAt)}` : 'Not received'}
                </span>
                {paymentProof?.receiptLink && (
                  <a href={paymentProof.receiptLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-accent-primary hover:underline flex items-center gap-0.5">
                    Receipt <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <ChevronRight className={`w-4 h-4 text-text-tertiary transition-transform ${paymentExpanded ? 'rotate-90' : ''}`} />
            </button>
            {paymentExpanded && (
              <div className="px-4 pb-3 text-sm text-text-secondary space-y-1 border-t border-border-muted pt-2">
                {paymentProof && (
                  <>
                    {paymentProof.inferred && (
                      <div className="text-status-warning-text">
                        Paid status is inferred from migrated booking data. Original receipt was not available in source export.
                      </div>
                    )}
                    <div>Reference: {paymentProof.paymentReference}</div>
                    {paymentProof.paymentIntentId && <div>Intent: {paymentProof.paymentIntentId}</div>}
                  </>
                )}
                <div>Payment link: {booking.paymentMessageState?.status === 'delivered' ? `Sent ${formatDateTime(booking.paymentMessageState.sentAt)}` : booking.paymentMessageState?.status || 'Not sent'}</div>
                {booking.paymentMessageState?.error && <div className="text-status-danger-text">Error: {booking.paymentMessageState.error}</div>}
              </div>
            )}

            <button type="button" onClick={() => setCalendarExpanded(!calendarExpanded)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-secondary transition min-h-[44px] border-t border-border-default">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">Calendar</span>
                <span className="text-sm text-text-secondary">
                  {calendarProof?.status === 'synced' ? 'Synced' : 'Not synced'}
                  {calendarProof?.connectedAccount && ` \u00b7 ${calendarProof.connectedAccount}`}
                </span>
                {calendarProof?.openInGoogleCalendarUrl && (
                  <a href={calendarProof.openInGoogleCalendarUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-accent-primary hover:underline flex items-center gap-0.5">
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <ChevronRight className={`w-4 h-4 text-text-tertiary transition-transform ${calendarExpanded ? 'rotate-90' : ''}`} />
            </button>
            {calendarExpanded && (
              <div className="px-4 pb-3 text-sm text-text-secondary space-y-1 border-t border-border-muted pt-2">
                {calendarProof?.lastSyncedAt && <div>Last synced: {formatDateTime(calendarProof.lastSyncedAt)}</div>}
                {calendarProof?.syncError && <div className="text-status-danger-text">Error: {calendarProof.syncError}</div>}
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => runFixMutation.mutate('calendar_repair')}>Repair calendar sync</Button>
              </div>
            )}
          </div>

          {/* Activity log — collapsed */}
          <div className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden">
            <button type="button" onClick={() => setActivityExpanded(!activityExpanded)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-secondary transition min-h-[44px]">
              <span className="text-sm font-medium text-text-primary">Activity ({events.length} event{events.length !== 1 ? 's' : ''})</span>
              <ChevronRight className={`w-4 h-4 text-text-tertiary transition-transform ${activityExpanded ? 'rotate-90' : ''}`} />
            </button>
            {activityExpanded && (
              <div className="border-t border-border-default">
                <div className="px-4 py-2">
                  <Input placeholder="Filter by type..." value={eventTypeFilter === 'all' ? '' : eventTypeFilter} onChange={(e) => setEventTypeFilter(e.target.value || 'all')} className="max-w-xs" />
                </div>
                {filteredEvents.length === 0 ? (
                  <div className="px-4 pb-4"><EmptyState title="No events" description="No activity recorded yet." /></div>
                ) : (
                  <DataTableShell stickyHeader>
                    <Table<EventItem>
                      forceTableLayout
                      columns={[
                        { key: 'createdAt', header: 'Time', mobileOrder: 1, mobileLabel: 'Time', render: (r) => formatDateTime(r.createdAt) },
                        { key: 'type', header: 'Type', mobileOrder: 2, mobileLabel: 'Type', render: (r) => formatLabel(r.type) },
                        { key: 'status', header: 'Status', mobileOrder: 3, mobileLabel: 'Status', render: (r) => <StatusChip>{r.status ? getStatusPill(r.status).label : '\u2014'}</StatusChip> },
                        { key: 'message', header: 'Message', mobileOrder: 4, mobileLabel: 'Message', hideBelow: 'md' },
                      ]}
                      data={filteredEvents}
                      keyExtractor={(r) => r.id}
                      emptyMessage="No events"
                    />
                  </DataTableShell>
                )}
                {events.some((e) => e.type.includes('automation') && e.status === 'failed') && (
                  <div className="px-4 pb-3">
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => runFixMutation.mutate('automation_failure')}>Retry failed automation</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </LayoutWrapper>

      <Modal
        isOpen={cancelModalOpen}
        onClose={() => !busy && setCancelModalOpen(false)}
        title="Cancel booking"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setCancelModalOpen(false)} disabled={busy}>Keep booking</Button>
            <Button variant="danger" onClick={() => { setCancelModalOpen(false); patchBooking({ status: 'cancelled' }, 'Booking cancelled'); }} disabled={busy}>
              Cancel booking
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-secondary">Are you sure you want to cancel this booking? This cannot be undone.</p>
      </Modal>
    </OwnerAppShell>
  );
}
