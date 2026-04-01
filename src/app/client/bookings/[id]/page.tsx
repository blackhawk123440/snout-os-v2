'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LayoutWrapper } from '@/components/layout';
import { useSSE } from '@/hooks/useSSE';
import { MessageSquare, RotateCcw } from 'lucide-react';
import { SitterTrustBadge } from '@/components/client/SitterTrustBadge';
import {
  AppCard,
  AppCardHeader,
  AppCardBody,
  AppPageHeader,
  AppSkeletonList,
  AppErrorState,
  AppStatusPill,
} from '@/components/app';
import { Button } from '@/components/ui';
import { toastSuccess, toastError } from '@/lib/toast';
import { formatServiceName } from '@/lib/format-utils';
import {
  useClientBookingDetail,
  useCancelBooking,
  useSubmitBookingComplaint,
} from '@/lib/api/client-hooks';

const ISSUE_TYPES = [
  { value: 'late_arrival', label: 'Late arrival' },
  { value: 'missed_service', label: 'Missed service' },
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'billing_issue', label: 'Billing issue' },
  { value: 'other', label: 'Other' },
];

export default function ClientBookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showComplaint, setShowComplaint] = useState(false);
  const [complaintType, setComplaintType] = useState('other');
  const [complaintDesc, setComplaintDesc] = useState('');
  const [complaintSent, setComplaintSent] = useState(false);

  useEffect(() => {
    if (id === 'new') { router.replace('/client/bookings/new'); }
  }, [id, router]);

  const { data: booking, isLoading: loading, error, refetch } = useClientBookingDetail(id);

  // SSE: real-time updates for this booking (visit started, completed, report posted)
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useSSE('/api/realtime/client/bookings', () => refetchRef.current(), true);
  const cancelMutation = useCancelBooking(id);
  const complaintMutation = useSubmitBookingComplaint(id);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const canCancel = booking && ['pending', 'confirmed', 'pending_payment', 'deposit_held'].includes(booking.status) && new Date(booking.startAt).getTime() > Date.now();
  const isWithin24h = booking ? new Date(booking.startAt).getTime() - Date.now() < 24 * 60 * 60 * 1000 : false;
  const isCompleted = booking?.status === 'completed';
  const [cancelPreview, setCancelPreview] = useState<{ refundAmount: number; refundPercent: number; description: string } | null>(null);

  const handleCancelPreview = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/bookings/${id}/cancel-preview`);
      const data = await res.json();
      if (data.canCancel === false) {
        toastError(data.reason || 'Cannot cancel this booking');
        return;
      }
      setCancelPreview(data);
      setShowCancelConfirm(true);
    } catch {
      toastError('Could not load cancellation details');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync();
      toastSuccess('Booking cancelled');
      setShowCancelConfirm(false);
      setCancelPreview(null);
    } catch (err: any) {
      toastError(err?.message || 'Failed to cancel');
    }
  };

  const handleComplaint = async () => {
    if (complaintDesc.length < 20) { toastError('Please provide more detail (at least 20 characters)'); return; }
    try {
      await complaintMutation.mutateAsync({ issueType: complaintType, description: complaintDesc });
      setComplaintSent(true);
      toastSuccess('Feedback submitted');
    } catch {
      toastError('Failed to submit');
    }
  };

  if (id === 'new') return null;

  const inputClass = 'w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none';

  return (
    <LayoutWrapper variant="narrow">
      <AppPageHeader
        title="Booking details"
        subtitle={booking ? formatServiceName(booking.service) : ''}
        action={
          <button type="button" onClick={() => router.back()} className="min-h-[44px] text-sm font-medium text-text-secondary hover:text-text-primary">
            Back
          </button>
        }
      />
      {loading ? (
        <AppSkeletonList count={2} />
      ) : error ? (
        <AppErrorState title="Couldn't load booking" subtitle={error.message || 'Booking not found'} onRetry={() => void refetch()} />
      ) : booking ? (
        <div className="flex flex-col gap-4 pb-8">
          <div className="rounded-3xl border border-border-default bg-surface-primary p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex rounded-full bg-accent-tertiary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-primary">
                Booking status
              </span>
            </div>
            <h2 className="text-xl font-bold text-text-primary">
              {booking.status === 'completed'
                ? 'This visit has been completed'
                : booking.status === 'in_progress'
                  ? 'Your visit is actively underway'
                  : 'Your care request is being managed'}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {booking.status === 'completed'
                ? 'Use this page to review what happened, revisit the report, or book similar care again.'
                : booking.status === 'in_progress'
                  ? 'You can use this page to track timing, sitter details, and communication while care is in progress.'
                  : 'Everything important for this booking lives here, including sitter details, timing, payment, and next actions.'}
            </p>
          </div>

          {/* Booking info */}
          <AppCard>
            <AppCardHeader>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-text-primary">{formatServiceName(booking.service)}</p>
                <AppStatusPill status={booking.status} />
              </div>
            </AppCardHeader>
            <AppCardBody>
              <p className="text-sm text-text-secondary">{formatDate(booking.startAt)}</p>
              <p className="mt-1 text-sm tabular-nums text-text-secondary">
                {formatTime(booking.startAt)} {'\u2013'} {formatTime(booking.endAt)}
              </p>
              {booking.address && <p className="mt-2 text-sm text-text-tertiary">{booking.address}</p>}
              {booking.pickupAddress && <p className="mt-2 text-sm text-text-tertiary">Pickup: {booking.pickupAddress}</p>}
              {booking.dropoffAddress && <p className="mt-1 text-sm text-text-tertiary">Dropoff: {booking.dropoffAddress}</p>}
              {booking.pets?.length > 0 && (
                <p className="mt-2 text-sm text-text-tertiary">
                  Pets: {booking.pets.map((p) => p.name || p.species || 'Pet').join(', ')}
                </p>
              )}
              {booking.sitter && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-text-secondary">Sitter: {booking.sitter.name}</p>
                    {booking.sitter.tier && (
                      <span className="rounded-full bg-accent-tertiary px-2 py-0.5 text-[10px] font-medium text-accent-primary">
                        {booking.sitter.tier}
                      </span>
                    )}
                  </div>
                  {booking.sitter.profile?.tierLabel && (
                    <SitterTrustBadge
                      tierLabel={booking.sitter.profile.tierLabel}
                      statements={booking.sitter.profile.statements || []}
                      sitterName={booking.sitter.name?.split(' ')[0]}
                    />
                  )}
                </div>
              )}
              {booking.totalPrice != null && booking.totalPrice > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-text-primary">${booking.totalPrice.toFixed(2)}</p>
                  {booking.pricingSnapshot && (() => {
                    try {
                      const snapshot = JSON.parse(booking.pricingSnapshot);
                      const breakdown: Array<{ label: string; amount: number }> = snapshot.breakdown || snapshot.lineItems || [];
                      if (breakdown.length <= 1) return null;
                      return (
                        <div className="mt-1.5 space-y-0.5">
                          {breakdown.map((item, i) => (
                            <div key={i} className="flex justify-between text-xs text-text-secondary">
                              <span>{item.label}</span>
                              <span className="tabular-nums">{item.amount < 0 ? '-' : ''}${Math.abs(item.amount).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    } catch { return null; }
                  })()}
                </div>
              )}
            </AppCardBody>
          </AppCard>

          {/* Visit Progress */}
          {booking.status === 'in_progress' && booking.checkedInAt && (
            <VisitProgress
              checkedInAt={booking.checkedInAt}
              scheduledStart={booking.startAt}
              scheduledEnd={booking.endAt}
              sitterName={booking.sitter?.name}
            />
          )}

          {/* Payment */}
          <AppCard>
            <AppCardHeader>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-text-primary">Payment</p>
                <AppStatusPill status={booking.paymentProof ? 'paid' : booking.paymentStatus || 'unpaid'} />
              </div>
            </AppCardHeader>
            <AppCardBody>
              {booking.paymentProof ? (
                <div className="space-y-1 text-sm text-text-secondary">
                  <p>Paid: <span className="font-semibold text-text-primary">${booking.paymentProof.amount.toFixed(2)}</span></p>
                  <p>{new Date(booking.paymentProof.paidAt).toLocaleString()}</p>
                  {(booking.paymentProof as any).inferred && (
                    <p className="text-xs text-status-warning-text">
                      Payment receipt data is unavailable for this migrated booking.
                    </p>
                  )}
                  {booking.paymentProof.receiptLink && (
                    <a href={booking.paymentProof.receiptLink} target="_blank" rel="noopener noreferrer" className="inline-flex text-sm font-medium text-accent-primary underline">
                      View receipt
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary">Payment pending.</p>
              )}
            </AppCardBody>
          </AppCard>

          {isCompleted && booking.reportId && (
            <AppCard>
              <AppCardBody>
                <Link
                  href={`/client/reports/${booking.reportId}`}
                  className="flex min-h-[44px] items-center justify-between rounded-lg text-sm font-medium text-accent-primary hover:underline"
                >
                  View visit report
                  <span className="text-text-tertiary">&rarr;</span>
                </Link>
              </AppCardBody>
            </AppCard>
          )}

          {/* Quick actions: Message + Book again */}
          <div className="flex gap-2">
            <Link
              href="/client/messages"
              className="flex flex-1 min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border-default bg-surface-primary px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-secondary"
            >
              <MessageSquare className="h-4 w-4" />
              Message business
            </Link>
            {isCompleted && (
              <Link
                href={`/client/bookings/new?service=${encodeURIComponent(booking.service || '')}`}
                className="flex flex-1 min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border-default bg-surface-primary px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-secondary"
              >
                <RotateCcw className="h-4 w-4" />
                Book again
              </Link>
            )}
          </div>

          {/* Cancel button */}
          {canCancel && (
            <div>
              {!showCancelConfirm ? (
                <Button variant="danger" size="md" onClick={() => void handleCancelPreview()} className="w-full">
                  Cancel booking
                </Button>
              ) : (
                <AppCard className="border-status-danger-border">
                  <AppCardBody>
                    <p className="text-sm font-semibold text-status-danger-text">Cancel this booking?</p>
                    {cancelPreview ? (
                      <div className="mt-2 rounded-lg bg-surface-secondary p-3">
                        {cancelPreview.refundAmount > 0 ? (
                          <p className="text-sm text-text-primary">
                            You&apos;ll receive a <span className="font-semibold">${cancelPreview.refundAmount.toFixed(2)}</span> refund ({cancelPreview.refundPercent}%).
                          </p>
                        ) : (
                          <p className="text-sm text-status-warning-text">No refund will be issued.</p>
                        )}
                        <p className="mt-1 text-xs text-text-tertiary">{cancelPreview.description}</p>
                      </div>
                    ) : isWithin24h ? (
                      <p className="mt-1 text-xs text-status-warning-text-secondary">This booking starts within 24 hours. A cancellation fee may apply.</p>
                    ) : null}
                    <p className="mt-2 text-sm text-text-secondary">This cannot be undone.</p>
                    <div className="mt-3 flex gap-2">
                      <Button variant="danger" size="md" onClick={handleCancel} disabled={cancelMutation.isPending} isLoading={cancelMutation.isPending} className="flex-1">
                        Yes, cancel
                      </Button>
                      <Button variant="secondary" size="md" onClick={() => { setShowCancelConfirm(false); setCancelPreview(null); }} className="flex-1">
                        Keep booking
                      </Button>
                    </div>
                  </AppCardBody>
                </AppCard>
              )}
            </div>
          )}

          {/* Complaint / Report issue (completed bookings) */}
          {isCompleted && !complaintSent && (
            <div>
              {!showComplaint ? (
                <button type="button" onClick={() => setShowComplaint(true)} className="min-h-[44px] text-sm font-medium text-text-tertiary hover:text-text-primary">
                  Report an issue
                </button>
              ) : (
                <AppCard>
                  <AppCardBody>
                    <p className="text-sm font-semibold text-text-primary mb-3">Report an issue</p>
                    <div className="space-y-3">
                      <select value={complaintType} onChange={(e) => setComplaintType(e.target.value)} className={inputClass}>
                        {ISSUE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <textarea
                        value={complaintDesc}
                        onChange={(e) => setComplaintDesc(e.target.value)}
                        placeholder="Please describe the issue (at least 20 characters)"
                        rows={3}
                        maxLength={2000}
                        className={`${inputClass} resize-y`}
                      />
                      <div className="flex gap-2">
                        <Button variant="primary" size="md" onClick={handleComplaint} disabled={complaintMutation.isPending} isLoading={complaintMutation.isPending} className="flex-1">
                          Submit
                        </Button>
                        <button type="button" onClick={() => setShowComplaint(false)} className="min-h-[44px] px-4 text-sm font-medium text-text-secondary hover:text-text-primary">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </AppCardBody>
                </AppCard>
              )}
            </div>
          )}
          {complaintSent && (
            <AppCard className="border-status-success-border bg-status-success-bg">
              <AppCardBody>
                <p className="text-sm font-medium text-status-success-text">Thank you for your feedback. We'll review this and get back to you within 24 hours.</p>
              </AppCardBody>
            </AppCard>
          )}
        </div>
      ) : null}
    </LayoutWrapper>
  );
}

/* ─── Visit Progress Component ──────────────────────────────────────── */

function VisitProgress({
  checkedInAt,
  scheduledStart,
  scheduledEnd,
  sitterName,
}: {
  checkedInAt: string;
  scheduledStart: string;
  scheduledEnd: string;
  sitterName?: string | null;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const checkInMs = new Date(checkedInAt).getTime();
  const elapsedMin = Math.max(0, Math.floor((now - checkInMs) / 60000));
  const scheduledDuration = Math.max(1, Math.floor(
    (new Date(scheduledEnd).getTime() - new Date(scheduledStart).getTime()) / 60000
  ));
  const progressPct = Math.min(100, Math.round((elapsedMin / scheduledDuration) * 100));
  const checkInTime = new Date(checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <AppCard className="border-status-success-border bg-status-success-bg">
      <AppCardBody>
        <div className="flex items-center gap-2 mb-2">
          <span className="h-2.5 w-2.5 rounded-full bg-status-success-fill animate-pulse" />
          <p className="text-sm font-semibold text-status-success-text">Visit in progress</p>
        </div>
        <p className="text-sm text-status-success-text-secondary">
          {sitterName || 'Your sitter'} started at {checkInTime}
        </p>
        <p className="text-sm text-status-success-text-secondary">Duration: {elapsedMin} minutes</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-2 overflow-hidden rounded-full bg-status-success-fill-muted">
            <div className="h-full rounded-full bg-status-success-fill transition-[width]" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs font-medium text-status-success-text-secondary tabular-nums">{elapsedMin}/{scheduledDuration} min</span>
        </div>
        <p className="mt-2 text-xs text-status-success-text-secondary">We'll notify you when the visit is complete.</p>
      </AppCardBody>
    </AppCard>
  );
}
