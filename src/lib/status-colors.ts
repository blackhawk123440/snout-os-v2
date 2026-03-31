/**
 * Shared status color utilities for all portals.
 * Uses CSS variable-backed Tailwind classes for dark mode support.
 */

/** Badge: subtle background + text for status pills/chips */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'bg-status-info-bg text-status-info-text';
    case 'in_progress':
      return 'bg-status-purple-bg text-status-purple-text';
    case 'completed':
      return 'bg-status-success-bg text-status-success-text';
    case 'pending':
      return 'bg-status-warning-bg text-status-warning-text';
    case 'cancelled':
      return 'bg-surface-tertiary text-text-secondary';
    default:
      return 'bg-surface-tertiary text-text-secondary';
  }
}

/** Dot: small colored indicator circle */
export function statusDotClass(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'bg-status-info-fill';
    case 'in_progress':
      return 'bg-status-purple-fill animate-pulse';
    case 'completed':
      return 'bg-status-success-fill';
    case 'pending':
      return 'bg-status-warning-fill';
    default:
      return 'bg-surface-tertiary';
  }
}

/** Block: card/event background + border for calendar blocks */
export function statusBlockClass(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'bg-status-info-bg border-status-info-border';
    case 'in_progress':
      return 'bg-status-purple-bg border-status-purple-border';
    case 'completed':
      return 'bg-status-success-bg border-status-success-border';
    case 'pending':
      return 'bg-status-warning-bg border-status-warning-border';
    default:
      return 'bg-surface-tertiary border-border-default';
  }
}

/** Readable label */
export function statusLabel(status: string): string {
  switch (status) {
    case 'confirmed': return 'Confirmed';
    case 'in_progress': return 'In progress';
    case 'completed': return 'Completed';
    case 'pending': return 'Pending';
    case 'cancelled': return 'Cancelled';
    case 'pending_payment': return 'Awaiting payment';
    case 'expired': return 'Expired';
    case 'no_show': return 'No show';
    default: return status.replace(/_/g, ' ');
  }
}
