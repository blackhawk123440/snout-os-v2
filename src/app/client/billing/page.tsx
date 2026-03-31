'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, DollarSign, ChevronRight, Trophy } from 'lucide-react';
import { LayoutWrapper, ClientRefreshButton } from '@/components/layout';
import { AppErrorState, AppStatusPill } from '@/components/app';
import { Button, Modal } from '@/components/ui';
import { toastSuccess, toastError } from '@/lib/toast';
import { formatServiceName } from '@/lib/format-utils';
import { useClientBilling, useClientPaymentMethods, useRemovePaymentMethod, useRedeemLoyaltyPoints } from '@/lib/api/client-hooks';

export default function ClientBillingPage() {
  const router = useRouter();
  const { data, isLoading: loading, error, refetch } = useClientBilling();
  const redeemMutation = useRedeemLoyaltyPoints();
  const polledRef = useRef(false);

  useEffect(() => {
    if (polledRef.current) return;
    polledRef.current = true;
    const timer = setTimeout(async () => {
      const before = data?.invoices.filter((i) => i.paymentStatus !== 'paid').length ?? 0;
      if (before === 0) return;
      const { data: fresh } = await refetch();
      if (!fresh) return;
      const after = fresh.invoices.filter((i) => i.paymentStatus !== 'paid').length;
      if (after < before) toastSuccess('Payment received! Thank you.');
    }, 2000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const formatDateTime = (d: string) =>
    new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const unpaidInvoices = data?.invoices.filter((i) => i.paymentStatus !== 'paid') || [];
  const outstandingTotal = unpaidInvoices.reduce((s, i) => s + i.totalPrice, 0);
  const firstPaymentLink = unpaidInvoices.find((i) => i.paymentLink)?.paymentLink;
  const paidCount = data?.paidCompletions?.length || 0;
  const totalPaid = data?.paidCompletions?.reduce((s, p) => s + p.amount, 0) || 0;

  return (
    <LayoutWrapper variant="narrow">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text-primary font-heading leading-tight sm:text-2xl">
            Billing
          </h1>
          <p className="text-[14px] text-text-secondary mt-0.5">Invoices, payments, and loyalty</p>
        </div>
        <ClientRefreshButton onRefresh={refetch} loading={loading} />
      </div>

      {loading ? (
        <BillingSkeleton />
      ) : error ? (
        <AppErrorState title="Couldn't load" subtitle={error.message || 'Unable to load'} onRetry={() => void refetch()} />
      ) : data ? (
        <div className="space-y-4 mt-4 pb-8">
          {/* Balance hero */}
          <div className="rounded-2xl bg-gradient-to-br from-accent-secondary via-surface-primary to-accent-secondary/30 border border-accent-secondary p-6 text-center shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-primary/60 mb-1">Outstanding balance</p>
            <p className="text-4xl font-bold text-text-primary tabular-nums">${outstandingTotal.toFixed(2)}</p>
            <p className="text-[13px] text-text-secondary mt-1">
              {unpaidInvoices.length} unpaid invoice{unpaidInvoices.length !== 1 ? 's' : ''}
            </p>
            {outstandingTotal > 0 && firstPaymentLink && (
              <a
                href={firstPaymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block"
              >
                <Button variant="primary" size="md">
                  Pay {unpaidInvoices.length === 1 ? `$${unpaidInvoices[0].totalPrice.toFixed(2)}` : 'now'}
                </Button>
              </a>
            )}
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface-primary shadow-sm p-4">
              <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Payments</p>
              <p className="mt-2 text-2xl font-bold text-text-primary tabular-nums">{paidCount}</p>
            </div>
            <div className="rounded-2xl bg-surface-primary shadow-sm p-4">
              <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Total paid</p>
              <p className="mt-2 text-2xl font-bold text-text-primary tabular-nums">${totalPaid.toFixed(0)}</p>
            </div>
          </div>

          {/* Unpaid invoices */}
          {unpaidInvoices.length > 0 && (
            <div className="rounded-2xl bg-surface-primary shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Unpaid</h2>
                <span className="text-[11px] font-semibold text-status-warning-text tabular-nums">{unpaidInvoices.length}</span>
              </div>
              <div className="divide-y divide-border-muted">
                {unpaidInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 px-5 py-3.5 min-h-[64px]">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-status-warning-bg">
                      <DollarSign className="h-4 w-4 text-status-warning-text" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-text-primary truncate">{formatServiceName(inv.service)}</p>
                      <p className="text-[12px] text-text-secondary mt-0.5 tabular-nums">
                        {formatDate(inv.startAt)}{inv.sitterName ? ` \u00b7 ${inv.sitterName}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-[15px] font-bold text-text-primary tabular-nums">${inv.totalPrice.toFixed(2)}</p>
                      {inv.paymentLink && (
                        <a href={inv.paymentLink} target="_blank" rel="noopener noreferrer">
                          <Button variant="primary" size="sm">Pay</Button>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Paid completions */}
          {data.paidCompletions?.length > 0 && (
            <div className="rounded-2xl bg-surface-primary shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Payment history</h2>
                <span className="text-[11px] font-semibold text-text-disabled tabular-nums">{data.paidCompletions.length}</span>
              </div>
              <div className="divide-y divide-border-muted">
                {data.paidCompletions.slice(0, 10).map((p) => (
                  <div key={`${p.invoiceReference}-${p.paidAt}`} className="flex items-center gap-3 px-5 py-3.5 min-h-[56px]">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-status-success-bg">
                      <DollarSign className="h-4 w-4 text-status-success-text" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-text-primary truncate">
                        {p.bookingService || 'Payment'}
                      </p>
                      <p className="text-[12px] text-text-tertiary mt-0.5 tabular-nums">
                        {p.bookingStartAt ? formatDate(p.bookingStartAt) + ' \u00b7 ' : ''}{formatDateTime(p.paidAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-[14px] font-semibold text-text-primary tabular-nums">${p.amount.toFixed(2)}</p>
                      {p.receiptLink && (
                        <a href={p.receiptLink} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-accent-primary hover:underline">
                          Receipt
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loyalty */}
          {data.loyalty && (
            <div className="rounded-2xl bg-surface-primary shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="w-3.5 h-3.5" /> Loyalty
                </h2>
              </div>
              <div className="px-5 pb-5">
                {(() => {
                  const tier = (data.loyalty.tier || 'bronze').toLowerCase();
                  const points = data.loyalty.points ?? 0;
                  const tiers = [
                    { next: 'Silver', needed: 100, start: 0 },
                    { next: 'Gold', needed: 200, start: 100 },
                    { next: 'Platinum', needed: 500, start: 300 },
                  ];
                  const tierNames = ['bronze', 'silver', 'gold', 'platinum'];
                  const tierIndex = tierNames.indexOf(tier);
                  const currentTierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
                  let progressLabel: string;
                  let progressPct = 0;
                  if (tierIndex < 0 || tierIndex >= tiers.length) {
                    progressLabel = `${points} points`;
                  } else if (tierIndex === 3) {
                    progressLabel = 'Max tier reached';
                    progressPct = 1;
                  } else {
                    const t = tiers[tierIndex];
                    const inTier = Math.max(0, Math.min(t.needed, points - t.start));
                    progressLabel = `${inTier} / ${t.needed} points to ${t.next}`;
                    progressPct = t.needed ? inTier / t.needed : 0;
                  }
                  return (
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-primary text-lg font-bold text-text-inverse shadow-sm">
                        {currentTierLabel[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-text-primary">{currentTierLabel} tier</p>
                        <p className="text-[13px] text-text-secondary mt-0.5">{progressLabel}</p>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-tertiary mt-2">
                          <div className="h-full rounded-full bg-accent-primary transition-[width]" style={{ width: `${Math.min(100, progressPct * 100)}%` }} />
                        </div>
                        {points >= 100 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="mt-3"
                            disabled={redeemMutation.isPending}
                            onClick={async () => {
                              try {
                                const result = await redeemMutation.mutateAsync(undefined);
                                if (result.success) {
                                  toastSuccess(result.message || `Redeemed ${result.pointsUsed} points for $${result.discountDollars} off`);
                                  refetch();
                                } else {
                                  toastError(result.error || 'Redemption failed');
                                }
                              } catch (err: any) {
                                toastError(err?.message || 'Redemption failed');
                              }
                            }}
                          >
                            {redeemMutation.isPending ? 'Redeeming...' : `Redeem ${Math.floor(points / 100) * 100} points for $${Math.floor(points / 100) * 5}`}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Service Bundles */}
          <BundlesSection />

          {/* Saved payment methods */}
          <SavedPaymentMethods />

          {/* Empty state */}
          {unpaidInvoices.length === 0 && (!data.paidCompletions || data.paidCompletions.length === 0) && data.payments.length === 0 && (
            <div className="rounded-2xl bg-accent-tertiary p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary shadow-sm mb-4">
                <CreditCard className="h-7 w-7 text-text-inverse" />
              </div>
              <p className="text-xl font-bold text-text-primary">No invoices yet</p>
              <p className="mt-2 text-sm text-text-secondary max-w-[280px] mx-auto leading-relaxed">
                Invoices appear here after completed visits.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="primary" size="md" onClick={() => router.push('/client/bookings')}>
                  View bookings
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </LayoutWrapper>
  );
}

/* ─── Service Bundles ────────────────────────────────────────────── */

function BundlesSection() {
  const queryClient = useQueryClient();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [confirmBundle, setConfirmBundle] = useState<{ id: string; name: string; priceInCents: number } | null>(null);

  const { data, isLoading } = useQuery<{
    bundles: Array<{ id: string; name: string; serviceType: string; visitCount: number; priceInCents: number; discountPercent: number; expirationDays: number }>;
    purchases: Array<{ id: string; bundleId: string; remainingVisits: number; expiresAt: string; status: string }>;
  }>({
    queryKey: ['client', 'bundles'],
    queryFn: async () => {
      const res = await fetch('/api/client/bundles');
      if (!res.ok) return { bundles: [], purchases: [] };
      return res.json();
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      setBuyingId(bundleId);
      const res = await fetch('/api/client/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Purchase failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setConfirmBundle(null);
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toastSuccess('Bundle purchase initiated');
        queryClient.invalidateQueries({ queryKey: ['client', 'bundles'] });
      }
      setBuyingId(null);
    },
    onError: (err: Error) => {
      toastError(err.message);
      setBuyingId(null);
    },
  });

  if (isLoading) return null;

  const bundles = data?.bundles || [];
  const purchases = (data?.purchases || []).filter(p => p.status === 'active');

  if (bundles.length === 0 && purchases.length === 0) return null;

  return (
    <div className="rounded-2xl bg-surface-primary shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Service bundles</h2>
      </div>
      <div className="px-5 pb-5 space-y-3">
        {bundles.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-default p-4">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-text-primary">{b.name}</p>
              <p className="text-[12px] text-text-tertiary mt-0.5">
                {b.visitCount} {b.serviceType} visits {'\u00b7'} {b.discountPercent}% off {'\u00b7'} {b.expirationDays}d
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[15px] font-bold tabular-nums text-text-primary">${(b.priceInCents / 100).toFixed(2)}</span>
              <Button variant="primary" size="sm" onClick={() => setConfirmBundle({ id: b.id, name: b.name, priceInCents: b.priceInCents })} disabled={buyingId === b.id} isLoading={buyingId === b.id}>
                Buy
              </Button>
            </div>
          </div>
        ))}
        {purchases.length > 0 && purchases.map((p) => {
          const bundle = bundles.find(b => b.id === p.bundleId);
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-status-success-border bg-status-success-bg p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-text-primary">{bundle?.name || 'Bundle'}</p>
                <p className="text-[12px] text-text-tertiary mt-0.5">
                  {p.remainingVisits} visits remaining {'\u00b7'} Expires {new Date(p.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-status-success-text px-2 py-0.5 rounded-full bg-status-success-bg border border-status-success-border">Active</span>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={!!confirmBundle}
        onClose={() => !purchaseMutation.isPending && setConfirmBundle(null)}
        title="Confirm purchase"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setConfirmBundle(null)} disabled={purchaseMutation.isPending}>Cancel</Button>
            <Button variant="primary" onClick={() => confirmBundle && purchaseMutation.mutate(confirmBundle.id)} disabled={purchaseMutation.isPending} isLoading={purchaseMutation.isPending}>
              Buy for ${confirmBundle ? (confirmBundle.priceInCents / 100).toFixed(2) : ''}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-secondary">
          Purchase &ldquo;{confirmBundle?.name}&rdquo; for <span className="font-semibold text-text-primary">${confirmBundle ? (confirmBundle.priceInCents / 100).toFixed(2) : ''}</span>?
        </p>
        <p className="mt-2 text-xs text-text-tertiary">You&apos;ll be redirected to complete payment.</p>
      </Modal>
    </div>
  );
}

/* ─── Saved Payment Methods ──────────────────────────────────────── */

function SavedPaymentMethods() {
  const { data, isLoading } = useClientPaymentMethods();
  const removeMutation = useRemovePaymentMethod();
  const [removeCard, setRemoveCard] = useState<{ id: string; last4: string } | null>(null);

  if (isLoading) return null;

  const methods = data?.methods || [];

  const brandIcon = (brand: string) => {
    switch (brand) {
      case 'visa': return 'Visa';
      case 'mastercard': return 'MC';
      case 'amex': return 'Amex';
      default: return brand;
    }
  };

  return (
    <div className="rounded-2xl bg-surface-primary shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
          <CreditCard className="w-3.5 h-3.5" /> Payment methods
        </h2>
      </div>
      <div className="px-5 pb-5">
        {methods.length === 0 ? (
          <p className="text-[13px] text-text-tertiary">No saved cards. Payment links will be sent for each booking.</p>
        ) : (
          <div className="space-y-2">
            {methods.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl border border-border-default px-4 py-3 min-h-[48px]">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold text-text-secondary bg-surface-tertiary rounded-lg px-2 py-1">
                    {brandIcon(m.brand)}
                  </span>
                  <span className="text-[13px] text-text-primary font-mono tabular-nums">
                    {'\u2022\u2022\u2022\u2022 '}{m.last4}
                  </span>
                  <span className="text-[12px] text-text-tertiary tabular-nums">
                    {m.expMonth}/{m.expYear}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setRemoveCard({ id: m.id, last4: m.last4 })}
                  disabled={removeMutation.isPending}
                  className="min-h-[44px] text-[12px] text-status-danger-text hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!removeCard}
        onClose={() => !removeMutation.isPending && setRemoveCard(null)}
        title="Remove card"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setRemoveCard(null)} disabled={removeMutation.isPending}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => removeCard && removeMutation.mutate(removeCard.id, {
                onSuccess: () => { setRemoveCard(null); },
                onError: () => toastError('Failed to remove card'),
              })}
              disabled={removeMutation.isPending}
              isLoading={removeMutation.isPending}
            >
              Remove
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-secondary">
          Remove card ending in <span className="font-semibold text-text-primary">{removeCard?.last4}</span>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

/* ─── Skeleton ──────────────────────────────────────────────────── */

function BillingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse mt-4">
      <div className="rounded-2xl border border-border-default bg-surface-primary p-6 text-center">
        <div className="h-3 w-28 rounded bg-surface-tertiary mx-auto" />
        <div className="h-10 w-32 rounded bg-surface-tertiary mx-auto mt-3" />
        <div className="h-3 w-20 rounded bg-surface-tertiary mx-auto mt-2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border-default bg-surface-primary p-4">
            <div className="h-3 w-16 rounded bg-surface-tertiary" />
            <div className="mt-3 h-7 w-10 rounded bg-surface-tertiary" />
          </div>
        ))}
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden">
          <div className="px-5 pt-5 pb-3"><div className="h-3 w-20 rounded bg-surface-tertiary" /></div>
          {[1, 2].map((j) => (
            <div key={j} className="flex items-center gap-3 px-5 py-3.5">
              <div className="h-10 w-10 rounded-2xl bg-surface-tertiary shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-surface-tertiary" />
                <div className="h-3 w-40 rounded bg-surface-tertiary" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
