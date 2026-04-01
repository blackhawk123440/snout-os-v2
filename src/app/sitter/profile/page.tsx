'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Wallet, BarChart3, GraduationCap, LogOut } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { ChangePasswordSection } from '@/components/auth/ChangePasswordSection';
import { StatusChip } from '@/components/ui/status-chip';
import { LayoutWrapper } from '@/components/layout';
import { toastError } from '@/lib/toast';
import {
  SitterPageHeader,
  SitterSkeletonList,
  SitterErrorState,
} from '@/components/sitter';
import {
  useSitterProfile,
  useToggleSitterAvailability,
  useAddSitterBlockOff,
  useRemoveSitterBlockOff,
  useConnectSitterStripe,
  useSitterDeleteAccount,
} from '@/lib/api/sitter-portal-hooks';

interface SitterProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  active: boolean;
  commissionPercentage: number;
  availabilityEnabled?: boolean;
  name: string;
}

interface BlockOffDay {
  id: string;
  date: string;
}

interface StripeStatus {
  connected: boolean;
  onboardingStatus?: string;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
}

export default function SitterProfilePage() {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [newBlockDate, setNewBlockDate] = useState('');

  const { data: profileData, isLoading: loading, error, refetch } = useSitterProfile();
  const profile = profileData?.profile as SitterProfile | undefined;
  const availability = profileData?.availability;
  const stripe = profileData?.stripe as StripeStatus | null | undefined;

  const toggleAvail = useToggleSitterAvailability();
  const addBlockOff = useAddSitterBlockOff();
  const removeBlock = useRemoveSitterBlockOff();
  const connectStripe = useConnectSitterStripe();
  const deleteAccount = useSitterDeleteAccount();

  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get('stripe') === 'return' || searchParams?.get('stripe') === 'refresh') {
      void refetch();
    }
  }, [searchParams, refetch]);

  const availabilityEnabled = availability?.availabilityEnabled ?? profile?.availabilityEnabled ?? true;
  const blockOffs: BlockOffDay[] = Array.isArray(availability?.blockOffDays) ? availability.blockOffDays : [];
  const stripeStatus: StripeStatus = stripe ?? { connected: false };

  const handleToggleAvailability = async () => {
    if (!profile) return;
    try {
      await toggleAvail.mutateAsync(!availabilityEnabled);
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const handleAddBlockOff = async () => {
    if (!newBlockDate.trim()) return;
    try {
      await addBlockOff.mutateAsync(newBlockDate);
      setNewBlockDate('');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to add');
    }
  };

  const handleRemoveBlockOff = async (id: string) => {
    try {
      await removeBlock.mutateAsync(id);
    } catch {
      toastError('Failed to remove');
    }
  };

  const handleConnectStripe = async () => {
    try {
      const result = await connectStripe.mutateAsync();
      if (result.onboardingUrl) window.location.href = result.onboardingUrl;
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to connect Stripe');
    }
  };

  const handleSignOut = async () => {
    const { signOut } = await import('next-auth/react');
    await signOut({ callbackUrl: '/login' });
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount.mutateAsync();
      setDeleteModalOpen(false);
      const { signOut } = await import('next-auth/react');
      await signOut({ callbackUrl: '/login' });
      window.location.href = '/login';
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to delete account');
    }
  };

  return (
    <LayoutWrapper variant="narrow">
      <SitterPageHeader title="Profile" subtitle="Account and settings" />
      {loading ? (
        <SitterSkeletonList count={3} />
      ) : error ? (
        <SitterErrorState
          title="Couldn't load profile"
          subtitle={error instanceof Error ? error.message : 'Unable to load profile'}
          onRetry={() => void refetch()}
        />
      ) : profile ? (
        <div className="space-y-4">
          {/* ── Personal Info ────────────────────────────────────────── */}
          <div className="rounded-2xl bg-accent-tertiary p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-primary to-accent-primary/80 text-2xl font-bold text-text-inverse shadow-sm">
                  {(profile.name || 'S').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-text-primary truncate">{profile.name}</p>
                  <p className="text-sm text-text-secondary truncate">{profile.email}</p>
                  {profile.phone && (
                    <p className="text-sm text-text-tertiary">{profile.phone}</p>
                  )}
                </div>
                <StatusChip variant={profile.active ? 'success' : 'neutral'}>
                  {profile.active ? 'Active' : 'Inactive'}
                </StatusChip>
              </div>
              <div className="mt-4 flex items-center gap-4 border-t border-border-default pt-4">
                <div className="flex-1">
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Commission</p>
                  <p className="text-sm font-semibold text-text-primary">{profile.commissionPercentage}%</p>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Status</p>
                  <p className="text-sm font-semibold text-text-primary">
                    {availabilityEnabled ? 'Available' : 'Off duty'}
                  </p>
                </div>
              </div>
          </div>

          {/* ── Account Readiness ──────────────────────────────────── */}
          <div className="rounded-2xl bg-surface-primary shadow-sm p-5">
            <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-4">Account readiness</h3>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/sitter/availability" className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-secondary p-3.5 min-h-[52px] hover:bg-surface-tertiary transition">
                  <Calendar className="h-4 w-4 text-text-tertiary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-tertiary">Availability</p>
                    <p className="text-sm font-medium text-text-primary">{availabilityEnabled ? 'Available' : 'Off duty'}</p>
                  </div>
                </Link>
                <Link href="#payouts" className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-secondary p-3.5 min-h-[52px] hover:bg-surface-tertiary transition" onClick={(e) => { e.preventDefault(); document.getElementById('payouts')?.scrollIntoView({ behavior: 'smooth' }); }}>
                  <Wallet className="h-4 w-4 text-text-tertiary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-tertiary">Payouts</p>
                    <p className="text-sm font-medium text-text-primary">{stripeStatus.connected && stripeStatus.payoutsEnabled ? 'Connected' : 'Setup needed'}</p>
                  </div>
                </Link>
                <Link href="/sitter/performance" className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-secondary p-3.5 min-h-[52px] hover:bg-surface-tertiary transition">
                  <BarChart3 className="h-4 w-4 text-text-tertiary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-tertiary">Performance</p>
                    <p className="text-sm font-medium text-text-primary">View metrics</p>
                  </div>
                </Link>
                <Link href="/sitter/training" className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-secondary p-3.5 min-h-[52px] hover:bg-surface-tertiary transition">
                  <GraduationCap className="h-4 w-4 text-text-tertiary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-tertiary">Training</p>
                    <p className="text-sm font-medium text-text-primary">View progress</p>
                  </div>
                </Link>
              </div>
          </div>

          {/* ── Availability ─────────────────────────────────────────── */}
          <div className="rounded-2xl bg-surface-primary shadow-sm p-5">
            <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-4">Availability</h3>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-text-primary">Available for new bookings</p>
                  <p className="text-xs text-text-tertiary">When off, you won&apos;t receive new assignments</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={availabilityEnabled}
                  onClick={() => void handleToggleAvailability()}
                  disabled={toggleAvail.isPending}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 disabled:opacity-50 ${
                    availabilityEnabled ? 'bg-accent-primary' : 'bg-surface-tertiary'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface-primary shadow ring-0 transition ${
                      availabilityEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="mt-6">
                <p className="mb-2 text-sm font-medium text-text-primary">Block off days</p>
                <p className="mb-3 text-xs text-text-tertiary">Days you&apos;re not available</p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={newBlockDate}
                    onChange={(e) => setNewBlockDate(e.target.value)}
                    className="rounded-xl border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus"
                  />
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => void handleAddBlockOff()}
                    disabled={!newBlockDate || addBlockOff.isPending}
                  >
                    {addBlockOff.isPending ? 'Adding...' : 'Add'}
                  </Button>
                </div>
                {blockOffs.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {blockOffs.map((b) => (
                      <li key={b.id} className="flex items-center justify-between rounded-lg bg-surface-secondary px-3 py-2 text-sm">
                        <span>{new Date(b.date + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <button
                          type="button"
                          onClick={() => void handleRemoveBlockOff(b.id)}
                          className="text-status-danger-text-secondary hover:text-status-danger-text text-sm"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
          </div>

          {/* ── Stripe Connect ───────────────────────────────────────── */}
          <div id="payouts" className="rounded-2xl bg-surface-primary shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Payouts</h3>
                <StatusChip variant={stripeStatus?.connected && stripeStatus.payoutsEnabled ? 'success' : 'warning'}>
                  {stripeStatus?.connected && stripeStatus.payoutsEnabled ? 'Connected' : 'Setup required'}
                </StatusChip>
            </div>
              {stripeStatus?.connected && stripeStatus.payoutsEnabled ? (
                <p className="text-sm text-text-secondary">Stripe connected. Payouts are enabled.</p>
              ) : stripeStatus?.connected ? (
                <>
                  <p className="text-sm text-text-secondary mb-3">Stripe connected but onboarding is incomplete. Complete setup to receive payouts.</p>
                  <Button variant="primary" size="md" onClick={() => void handleConnectStripe()} disabled={connectStripe.isPending}>
                    {connectStripe.isPending ? 'Loading...' : 'Complete setup'}
                  </Button>
                </>
              ) : (
                <>
                  <p className="mb-3 text-sm text-text-secondary">Connect your Stripe account to receive payouts from completed bookings.</p>
                  <Button variant="primary" size="md" onClick={() => void handleConnectStripe()} disabled={connectStripe.isPending}>
                    {connectStripe.isPending ? 'Connecting...' : 'Connect Stripe'}
                  </Button>
                </>
              )}
          </div>

          {/* ── Change Password ──────────────────────────────── */}
          <ChangePasswordSection />

          {/* ── Sign Out ───────────────────────────────────────── */}
          <div className="rounded-2xl bg-surface-secondary p-5">
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
          </div>

          {/* ── Danger Zone ──────────────────────────────────────────── */}
          <div className="rounded-2xl border border-status-danger-border bg-surface-primary p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Delete account</p>
                  <p className="text-xs text-text-tertiary">Permanently remove your sitter account</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDeleteModalOpen(true)}
                  className="border-status-danger-border text-status-danger-text hover:bg-status-danger-bg shrink-0"
                >
                  Delete
                </Button>
              </div>
          </div>
        </div>
      ) : null}

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !deleteAccount.isPending && setDeleteModalOpen(false)}
        title="Delete account"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleteAccount.isPending}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleDeleteAccount()}
              disabled={deleteAccount.isPending}
              className="bg-status-danger-fill text-status-danger-text-on-fill hover:bg-status-danger-fill-hover"
            >
              {deleteAccount.isPending ? 'Deleting...' : 'Delete account'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-secondary">
          Are you sure? This will permanently delete your sitter account. You will be signed out immediately and cannot sign in again.
        </p>
      </Modal>
    </LayoutWrapper>
  );
}
