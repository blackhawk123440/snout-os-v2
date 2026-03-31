/**
 * Outstanding Balance Check
 *
 * Clients with unpaid bookings cannot create new bookings.
 * Enforces "first-paid, first-secured" policy.
 */

import { getScopedDb } from '@/lib/tenancy';

export async function checkOutstandingBalance(params: {
  orgId: string;
  clientId: string;
}): Promise<{
  hasOutstanding: boolean;
  totalOutstanding: number;
  bookings: Array<{
    id: string;
    service: string;
    startAt: string;
    totalPrice: number;
    paymentLink: string | null;
  }>;
}> {
  const db = getScopedDb({ orgId: params.orgId });

  const unpaidBookings = await (db as any).booking.findMany({
    where: {
      clientId: params.clientId,
      paymentStatus: { in: ['unpaid', 'balance_due'] },
      status: { notIn: ['cancelled', 'expired'] },
    },
    select: {
      id: true,
      service: true,
      startAt: true,
      totalPrice: true,
      stripePaymentLinkUrl: true,
    },
    orderBy: { startAt: 'asc' },
  });

  const totalOutstanding = unpaidBookings.reduce((sum: number, b: any) => sum + (b.totalPrice || 0), 0);

  return {
    hasOutstanding: totalOutstanding > 0,
    totalOutstanding,
    bookings: unpaidBookings.map((b: any) => ({
      id: b.id,
      service: b.service,
      startAt: b.startAt instanceof Date ? b.startAt.toISOString() : String(b.startAt),
      totalPrice: b.totalPrice,
      paymentLink: b.stripePaymentLinkUrl || null,
    })),
  };
}
