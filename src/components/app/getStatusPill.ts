/**
 * getStatusPill - Consistent status pill styling (single source of truth)
 * Maps common status strings to visual variants. Use everywhere - no page-specific status names.
 */

export type StatusPillVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface StatusPillConfig {
  variant: StatusPillVariant;
  label: string;
}

const STATUS_MAP: Record<string, StatusPillConfig> = {
  // Booking (canonical: pending, confirmed, in_progress, completed, cancelled)
  pending: { variant: 'warning', label: 'Pending' },
  confirmed: { variant: 'success', label: 'Confirmed' },
  in_progress: { variant: 'info', label: 'In progress' },
  'in-progress': { variant: 'info', label: 'In progress' },
  completed: { variant: 'success', label: 'Completed' },
  cancelled: { variant: 'error', label: 'Cancelled' },
  // Payment (paid → slate/neutral; unpaid → amber)
  paid: { variant: 'default', label: 'Paid' },
  unpaid: { variant: 'warning', label: 'Unpaid' },
  partial: { variant: 'warning', label: 'Partial' },
  // Dispatch
  auto: { variant: 'default', label: 'Auto' },
  manual_required: { variant: 'warning', label: 'Needs Attention' },
  manual_in_progress: { variant: 'info', label: 'In progress' },
  assigned: { variant: 'success', label: 'Assigned' },
  // Visit (in_progress/'in-progress' already defined above for Booking)
  scheduled: { variant: 'info', label: 'Scheduled' },
  // Message delivery (if available)
  sent: { variant: 'success', label: 'Sent' },
  // Generic
  active: { variant: 'success', label: 'Active' },
  inactive: { variant: 'default', label: 'Inactive' },
  draft: { variant: 'default', label: 'Draft' },
  failed: { variant: 'error', label: 'Failed' },
  released: { variant: 'error', label: 'Released' },
  reversed: { variant: 'error', label: 'Reversed' },
  partial_reversal: { variant: 'warning', label: 'Partial Reversal' },
  // Tier (bronze/silver/gold → slate)
  bronze: { variant: 'default', label: 'Bronze' },
  silver: { variant: 'default', label: 'Silver' },
  gold: { variant: 'default', label: 'Gold' },
};

function formatStatusLabel(raw: string): string {
  if (!raw) return '—';
  const s = raw.trim().replace(/_/g, ' ');
  return s
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function getStatusPill(status: string): StatusPillConfig {
  const s = String(status || '').toLowerCase().trim();
  const normalized = s.replace(/\s+/g, '_').replace(/-/g, '_');
  const mapped = STATUS_MAP[s] ?? STATUS_MAP[normalized];
  if (mapped) return mapped;
  return { variant: 'default', label: formatStatusLabel(status || '') };
}

/** Canonical booking status labels - use instead of hardcoding */
export function getBookingStatusLabel(status: string): string {
  return getStatusPill(status).label;
}
