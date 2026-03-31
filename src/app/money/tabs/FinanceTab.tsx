'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Clock, TrendingUp, FileText } from 'lucide-react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppErrorState, AppStatCard } from '@/components/app';
import { Button, EmptyState } from '@/components/ui';
import { PageSkeleton } from '@/components/ui/loading-state';
import { toastSuccess, toastError } from '@/lib/toast';
import { formatServiceName, formatDate } from '@/lib/format-utils';

interface FinanceSummary {
  totalCollectedThisMonth: number;
  totalCollectedAllTime: number;
  totalOutstanding: number;
  outstandingCount: number;
  collectionRate: number;
  recentPayments: Array<{
    chargeId: string;
    bookingId: string | null;
    amount: number;
    clientName: string;
    service: string;
    paidAt: string;
  }>;
  unpaidInvoices: Array<{
    bookingId: string;
    clientName: string;
    clientPhone: string;
    service: string;
    amount: number;
    createdAt: string;
    daysSinceCreated: number;
    paymentLink: string | null;
    remindersSent: number;
  }>;
}

export function FinanceTab() {
  const queryClient = useQueryClient();

  const { data, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['owner', 'finance-summary'],
    queryFn: async () => {
      const res = await fetch('/api/ops/finance/summary');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed');
      return json;
    },
  });

  const error = queryError?.message ?? null;

  const sendPaymentLinkMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await fetch('/api/messages/send-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      if (!res.ok) throw new Error('Failed to send link');
    },
    onSuccess: () => {
      toastSuccess('Payment link sent');
      queryClient.invalidateQueries({ queryKey: ['owner', 'finance-summary'] });
    },
    onError: () => toastError('Failed to send link'),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await fetch(`/api/ops/bookings/${bookingId}/mark-paid`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark as paid');
    },
    onSuccess: () => {
      toastSuccess('Marked as paid');
      queryClient.invalidateQueries({ queryKey: ['owner', 'finance-summary'] });
    },
    onError: () => toastError('Failed to mark as paid'),
  });

  const refundMutation = useMutation({
    mutationFn: async ({ bookingId }: { bookingId: string; amount: number }) => {
      const res = await fetch(`/api/ops/bookings/${bookingId}/refund`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Refund failed');
      return json;
    },
    onSuccess: (json, { amount }) => {
      toastSuccess(`Refund of $${json.amount?.toFixed(2) || amount.toFixed(2)} processed`);
      queryClient.invalidateQueries({ queryKey: ['owner', 'finance-summary'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Refund failed'),
  });

  const sendRemindersMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ops/invoicing/send-reminders', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to send reminders');
      return json;
    },
    onSuccess: (json) => {
      toastSuccess(`Sent ${json.sent} reminder${json.sent !== 1 ? 's' : ''}${json.skipped ? `, ${json.skipped} skipped` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['owner', 'finance-summary'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Failed to send reminders'),
  });

  const sendPaymentLink = (bookingId: string) => sendPaymentLinkMutation.mutate(bookingId);
  const markPaid = (bookingId: string) => markPaidMutation.mutate(bookingId);
  const issueRefund = (bookingId: string, amount: number) => {
    if (!confirm(`Refund $${amount.toFixed(2)}? This will be processed via Stripe.`)) return;
    refundMutation.mutate({ bookingId, amount });
  };
  const sendReminders = () => sendRemindersMutation.mutate();
  const sendingReminders = sendRemindersMutation.isPending;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div>
      {loading ? (
        <PageSkeleton />
      ) : error ? (
        <AppErrorState title="Couldn't load finance" subtitle={error} onRetry={() => void refetch()} />
      ) : data ? (
        <div className="space-y-6">
          {/* Stats strip */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <AppStatCard
              label="This month"
              value={`$${data.totalCollectedThisMonth.toLocaleString()}`}
              icon={<DollarSign size={16} />}
            />
            <AppStatCard
              label="Outstanding"
              value={`$${data.totalOutstanding.toLocaleString()}`}
              icon={<Clock size={16} />}
            />
            <AppStatCard
              label="Collection rate"
              value={`${data.collectionRate}%`}
              icon={<TrendingUp size={16} />}
            />
            <AppStatCard
              label="Unpaid invoices"
              value={String(data.outstandingCount)}
              icon={<FileText size={16} />}
            />
          </div>

          {/* Unpaid invoices */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                Unpaid invoices <span className="text-text-disabled tabular-nums">{data.unpaidInvoices.length}</span>
              </h2>
              {data.unpaidInvoices.length > 0 && (
                <button
                  type="button"
                  onClick={() => void sendReminders()}
                  disabled={sendingReminders}
                  className="min-h-[36px] rounded-lg border border-border-default bg-surface-primary px-3 text-xs font-medium text-text-secondary hover:bg-surface-secondary transition disabled:opacity-50"
                >
                  {sendingReminders ? 'Sending\u2026' : 'Send reminders'}
                </button>
              )}
            </div>

            {data.unpaidInvoices.length === 0 ? (
              <div className="rounded-2xl border border-status-success-border bg-status-success-bg p-4 text-center">
                <p className="text-sm font-medium text-status-success-text">All caught up \u2014 no unpaid invoices</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.unpaidInvoices.map((inv: any) => (
                  <div
                    key={inv.bookingId}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border-default bg-surface-primary px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        {inv.clientName} \u00b7 {formatServiceName(inv.service)}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        ${inv.amount.toFixed(2)} \u00b7 {inv.daysSinceCreated === 0 ? 'today' : `${inv.daysSinceCreated}d ago`}
                        {inv.remindersSent > 0 && ` \u00b7 ${inv.remindersSent} reminder${inv.remindersSent !== 1 ? 's' : ''} sent`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => void sendPaymentLink(inv.bookingId)}
                        className="min-h-[36px] rounded-lg border border-border-default bg-surface-primary px-2.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary transition"
                      >
                        Send link
                      </button>
                      <button
                        type="button"
                        onClick={() => void markPaid(inv.bookingId)}
                        className="min-h-[36px] rounded-lg border border-border-default bg-surface-primary px-2.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary transition"
                      >
                        Mark paid
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent payments */}
          <div>
            <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">
              Recent payments
            </h2>
            {data.recentPayments.length === 0 ? (
              <EmptyState
                title="No payments yet"
                description="Payments will appear here when clients pay their invoices."
              />
            ) : (
              <div className="space-y-2">
                {data.recentPayments.map((p: any) => (
                  <div
                    key={p.chargeId}
                    className="flex items-center gap-3 rounded-2xl border border-border-default bg-surface-primary px-4 py-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-success-bg text-status-success-text text-sm">
                      {'\u2713'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        ${p.amount.toFixed(2)}
                        <span className="font-normal text-text-secondary"> \u00b7 {p.clientName}</span>
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {formatServiceName(p.service)} \u00b7 {formatDate(p.paidAt)}
                      </p>
                    </div>
                    {p.bookingId && (
                      <button
                        type="button"
                        onClick={() => void issueRefund(p.bookingId!, p.amount)}
                        className="shrink-0 min-h-[36px] rounded-lg border border-border-default px-2.5 text-xs font-medium text-status-danger-text-secondary hover:bg-status-danger-bg transition"
                      >
                        Refund
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Revenue Optimization */}
          <RevenueOptimizationSection />

          {/* Annual Summary */}
          <AnnualSummarySection />

          {/* Bulk Cancel */}
          <BulkCancelSection onDone={() => void refetch()} />
        </div>
      ) : null}
    </div>
  );
}

/* ─── Annual Summary ────────────────────────────────────────────────── */

function AnnualSummarySection() {
  const [summary, setSummary] = useState<{
    year: number;
    monthlyRevenue: Array<{ month: number; label: string; amount: number }>;
    totalCollected: number;
    totalOutstanding: number;
    topClients: Array<{ clientName: string; revenue: number; bookings: number }>;
    topServices: Array<{ service: string; revenue: number; bookings: number }>;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/ops/finance/annual-summary?year=${new Date().getFullYear()}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSummary(d); })
      .catch(() => {});
  }, []);

  if (!summary) return null;

  const maxRevenue = Math.max(...summary.monthlyRevenue.map((m) => m.amount), 1);

  return (
    <div>
      <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">Year in review ({summary.year})</h2>
      <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p className="text-xs text-text-tertiary">Total collected</p>
            <p className="text-lg font-bold text-text-primary">${summary.totalCollected.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">Outstanding</p>
            <p className="text-lg font-bold text-text-primary">${summary.totalOutstanding.toLocaleString()}</p>
          </div>
        </div>
        {/* Monthly bar chart */}
        <div className="flex items-end gap-1 h-24 mb-2">
          {summary.monthlyRevenue.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center">
              <div
                className="w-full rounded-t bg-accent-primary min-h-[2px]"
                style={{ height: `${Math.max(2, (m.amount / maxRevenue) * 100)}%` }}
                title={`${m.label}: $${m.amount.toFixed(0)}`}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          {summary.monthlyRevenue.map((m) => (
            <div key={m.month} className="flex-1 text-center text-[9px] text-text-tertiary">{m.label}</div>
          ))}
        </div>
        {/* Top clients */}
        {summary.topClients.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-text-secondary mb-1">Top clients</p>
            {summary.topClients.slice(0, 5).map((c, i) => (
              <div key={i} className="flex justify-between text-xs py-0.5">
                <span className="text-text-primary">{c.clientName}</span>
                <span className="text-text-secondary tabular-nums">${c.revenue.toFixed(0)} ({c.bookings})</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Revenue Optimization ─────────────────────────────────────────── */

function RevenueOptimizationSection() {
  const { data } = useQuery({
    queryKey: ['revenue-optimization'],
    queryFn: async () => {
      const res = await fetch('/api/ops/revenue-optimization');
      return res.ok ? res.json() : null;
    },
    staleTime: 300000,
  });

  if (!data) return null;

  return (
    <div className="rounded-2xl border border-border-default bg-surface-primary p-4 mt-4">
      <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">Revenue optimization</h2>

      {/* Capacity alert */}
      {data.capacityAlert && data.capacityAlert.utilizationPercent < 60 && (
        <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-3 mb-3">
          <div className="text-sm font-medium text-status-warning-text">Low capacity tomorrow</div>
          <div className="text-xs text-status-warning-text-secondary">
            {data.capacityAlert.bookings} bookings / {data.capacityAlert.estimatedCapacity} capacity ({data.capacityAlert.utilizationPercent}%)
          </div>
        </div>
      )}

      {/* Upsell opportunities */}
      {data.upsellOpportunities?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-text-secondary mb-1">Bundle upsell opportunities</div>
          {data.upsellOpportunities.slice(0, 3).map((opp: any) => (
            <div key={opp.clientId} className="flex items-center justify-between rounded border p-2 mb-1 text-sm">
              <span>{opp.clientName}</span>
              <span className="text-xs text-text-tertiary">{opp.bookingsThisMonth} {formatServiceName(opp.service)} bookings this month</span>
            </div>
          ))}
        </div>
      )}

      {/* Revenue by service */}
      {data.revenueByService?.length > 0 && (
        <div>
          <div className="text-xs font-medium text-text-secondary mb-1">Revenue by service (this month)</div>
          <div className="flex flex-col gap-1">
            {data.revenueByService.map((s: any) => (
              <div key={s.service} className="flex items-center justify-between text-sm">
                <span>{formatServiceName(s.service)}</span>
                <span className="font-medium tabular-nums">${(s.totalCents / 100).toLocaleString()} ({s.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Bulk Cancel ───────────────────────────────────────────────────── */

function BulkCancelSection({ onDone }: { onDone: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('weather');
  const queryClient = useQueryClient();

  const bulkCancelMutation = useMutation({
    mutationFn: async ({ date, reason }: { date: string; reason: string }) => {
      const res = await fetch('/api/ops/bookings/bulk-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, reason, notifyClients: true, notifySitters: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed');
      return { ...json, date };
    },
    onSuccess: (json) => {
      toastSuccess(`Cancelled ${json.cancelled} bookings for ${json.date}`);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['owner', 'finance-summary'] });
      onDone();
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Failed'),
  });

  const processing = bulkCancelMutation.isPending;

  const handleBulkCancel = () => {
    if (!date) { toastError('Select a date'); return; }
    bulkCancelMutation.mutate({ date, reason });
  };

  const inputClass = 'w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none';

  return (
    <div>
      {!showForm ? (
        <button type="button" onClick={() => setShowForm(true)} className="text-sm font-medium text-status-danger-text-secondary hover:underline">
          Bulk cancel bookings (weather/emergency)
        </button>
      ) : (
        <div className="rounded-2xl border border-status-danger-border bg-status-danger-bg p-4 space-y-3">
          <p className="text-sm font-semibold text-status-danger-text">Bulk Cancel</p>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass}>
            <option value="weather">Weather</option>
            <option value="emergency">Emergency</option>
            <option value="owner_decision">Owner decision</option>
            <option value="other">Other</option>
          </select>
          <div className="flex gap-2">
            <button type="button" onClick={handleBulkCancel} disabled={processing} className="min-h-[44px] flex-1 rounded-lg bg-status-danger-fill px-4 text-sm font-semibold text-status-danger-text-on-fill hover:bg-status-danger-fill-hover disabled:opacity-50">
              {processing ? 'Cancelling\u2026' : 'Cancel all bookings'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="min-h-[44px] px-4 text-sm font-medium text-text-secondary">Nevermind</button>
          </div>
        </div>
      )}
    </div>
  );
}
