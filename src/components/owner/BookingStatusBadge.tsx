'use client';

import { StatusChip, type StatusChipVariant } from '@/components/ui/status-chip';

const STATUS_MAP: Record<string, { variant: StatusChipVariant; label: string }> = {
  pending: { variant: 'warning', label: 'Pending' },
  pending_payment: { variant: 'warning', label: 'Awaiting payment' },
  confirmed: { variant: 'info', label: 'Confirmed' },
  in_progress: { variant: 'info', label: 'In progress' },
  completed: { variant: 'neutral', label: 'Completed' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
  expired: { variant: 'neutral', label: 'Expired' },
  no_show: { variant: 'danger', label: 'No show' },
};

const PAYMENT_MAP: Record<string, { variant: StatusChipVariant; label: string }> = {
  paid: { variant: 'success', label: 'Paid' },
  unpaid: { variant: 'warning', label: 'Unpaid' },
  partial: { variant: 'warning', label: 'Partial' },
  refunded: { variant: 'neutral', label: 'Refunded' },
  deposit_paid: { variant: 'info', label: 'Deposit paid' },
  refund_full: { variant: 'neutral', label: 'Refunded' },
};

export interface BookingStatusBadgeProps {
  status: string;
  className?: string;
}

export function BookingStatusBadge({ status, className }: BookingStatusBadgeProps) {
  const mapped = STATUS_MAP[status] ?? { variant: 'neutral' as StatusChipVariant, label: status.replace(/_/g, ' ') };
  return (
    <StatusChip variant={mapped.variant} className={className} ariaLabel={`Booking status: ${mapped.label}`}>
      {mapped.label}
    </StatusChip>
  );
}

export interface PaymentStatusBadgeProps {
  status: string;
  bookingStatus?: string;
  className?: string;
}

export function PaymentStatusBadge({ status, bookingStatus, className }: PaymentStatusBadgeProps) {
  let mapped = PAYMENT_MAP[status];
  if (!mapped) {
    // Infer from booking status when payment status is missing
    if (bookingStatus && ['confirmed', 'completed'].includes(bookingStatus)) {
      mapped = { variant: 'warning', label: 'Unpaid' };
    } else {
      mapped = { variant: 'neutral', label: 'Pending' };
    }
  }
  return (
    <StatusChip variant={mapped.variant} className={className} ariaLabel={`Payment: ${mapped.label}`}>
      {mapped.label}
    </StatusChip>
  );
}
