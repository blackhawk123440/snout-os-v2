'use client';

import { useRouter } from 'next/navigation';
import { User, ChevronRight } from 'lucide-react';
import { StatusChip } from '@/components/ui/status-chip';

export interface SitterCardData {
  id: string;
  firstName: string;
  lastName: string;
  active: boolean;
  currentTier?: string | null;
  onboardingStatus?: string | null;
  email?: string | null;
  commissionPercentage?: number | null;
}

export interface SitterCardProps {
  sitter: SitterCardData;
}

const ONBOARDING_CHIP: Record<string, { variant: 'success' | 'warning' | 'info' | 'danger' | 'neutral'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  invited: { variant: 'info', label: 'Invited' },
  onboarding: { variant: 'warning', label: 'Onboarding' },
  pending_review: { variant: 'warning', label: 'Pending review' },
  rejected: { variant: 'danger', label: 'Rejected' },
  deactivated: { variant: 'neutral', label: 'Deactivated' },
};

const TIER_CHIP: Record<string, string> = {
  foundation: 'bg-surface-tertiary text-text-secondary',
  reliant: 'bg-status-info-bg text-status-info-text',
  trusted: 'bg-status-purple-bg text-status-purple-text',
  preferred: 'bg-status-success-bg text-status-success-text',
};

export function SitterCard({ sitter }: SitterCardProps) {
  const router = useRouter();
  const name = `${sitter.firstName} ${sitter.lastName}`.trim();
  const initials = `${sitter.firstName?.[0] || ''}${sitter.lastName?.[0] || ''}`.toUpperCase();
  const status = sitter.onboardingStatus || (sitter.active ? 'active' : 'deactivated');
  const chip = ONBOARDING_CHIP[status] ?? ONBOARDING_CHIP.active;
  const tierKey = sitter.currentTier?.toLowerCase();
  const tierClass = tierKey ? TIER_CHIP[tierKey] : null;

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-primary px-4 py-3 transition hover:bg-surface-secondary cursor-pointer"
      onClick={() => router.push(`/sitters/${sitter.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/sitters/${sitter.id}`)}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-tertiary text-sm font-semibold text-accent-primary">
        {initials || <User className="h-4 w-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-text-primary truncate">{name}</p>
          <StatusChip variant={chip.variant}>{chip.label}</StatusChip>
          {tierClass && sitter.currentTier && (
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tierClass}`}>
              {sitter.currentTier}
            </span>
          )}
        </div>
        {sitter.email && (
          <p className="mt-0.5 text-xs text-text-tertiary truncate">{sitter.email}</p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-text-disabled shrink-0" />
    </div>
  );
}
