/**
 * Cancellation & Refund Engine
 *
 * Policy:
 * - >48h before start: full refund (minus non-refundable deposit)
 * - 24–48h before start: 50% refund (of non-deposit portion)
 * - <24h (day-of): no refund
 * - Holiday bookings: non-refundable under all circumstances
 * - Deposits (25% on 30+ day bookings): non-refundable under all circumstances
 */

export interface CancellationResult {
  refundPercent: number;
  refundAmount: number;
  depositKept: number;
  reason: 'more_than_48h' | 'within_48h' | 'day_of' | 'holiday_nonrefundable';
  description: string;
}

export function calculateRefund(
  booking: {
    totalPrice: number;
    depositAmount?: number | null;
    startAt: Date | string;
    holiday: boolean;
  },
  cancelledAt: Date = new Date()
): CancellationResult {
  const startTime = new Date(booking.startAt).getTime();
  const cancelTime = cancelledAt.getTime();
  const hoursUntilStart = (startTime - cancelTime) / (1000 * 60 * 60);
  const deposit = booking.depositAmount || 0;
  const paidAmount = booking.totalPrice;

  // Holiday bookings: NO refund ever
  if (booking.holiday) {
    return {
      refundPercent: 0,
      refundAmount: 0,
      depositKept: deposit,
      reason: 'holiday_nonrefundable',
      description: 'Holiday bookings are non-refundable.',
    };
  }

  // More than 48 hours: full refund (minus non-refundable deposit)
  if (hoursUntilStart > 48) {
    const refundable = paidAmount - deposit;
    return {
      refundPercent: deposit > 0 ? Math.round((refundable / paidAmount) * 100) : 100,
      refundAmount: Math.max(refundable, 0),
      depositKept: deposit,
      reason: 'more_than_48h',
      description: deposit > 0
        ? `Full refund of $${refundable.toFixed(2)}. Your $${deposit.toFixed(2)} deposit is non-refundable.`
        : `Full refund of $${paidAmount.toFixed(2)}.`,
    };
  }

  // 24–48 hours: 50% refund (of the non-deposit portion)
  if (hoursUntilStart > 24) {
    const refundable = Math.max((paidAmount - deposit) * 0.5, 0);
    return {
      refundPercent: 50,
      refundAmount: refundable,
      depositKept: deposit,
      reason: 'within_48h',
      description: `50% refund of $${refundable.toFixed(2)}. Cancellations within 48 hours receive a 50% refund.`,
    };
  }

  // Less than 24 hours: no refund
  return {
    refundPercent: 0,
    refundAmount: 0,
    depositKept: deposit,
    reason: 'day_of',
    description: 'Day-of cancellations are non-refundable.',
  };
}
