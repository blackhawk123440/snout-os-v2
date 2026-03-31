/**
 * GET /api/client/billing
 * Returns unpaid invoices (bookings with payment links) and loyalty points
 */

import { NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getScopedDb(ctx);
  try {
    const [unpaidBookings, clientBookings, loyalty] = await Promise.all([
      db.booking.findMany({
        where: {
          clientId: ctx.clientId,
          paymentStatus: { not: 'paid' },
          status: { not: 'cancelled' },
        },
        select: {
          id: true,
          service: true,
          startAt: true,
          totalPrice: true,
          stripePaymentLinkUrl: true,
          paymentStatus: true,
          sitter: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startAt: 'desc' },
        take: 20,
      }),
      db.booking.findMany({
        where: { clientId: ctx.clientId },
        select: {
          id: true,
          service: true,
          startAt: true,
          paymentStatus: true,
          totalPrice: true,
        },
        orderBy: { startAt: 'desc' },
        take: 100,
      }),
      db.loyaltyReward.findFirst({
        where: { clientId: ctx.clientId },
        select: { points: true, tier: true },
      }),
    ]);
    const clientBookingIds = (clientBookings || []).map((b) => b.id);
    const paymentHistory = await db.stripeCharge.findMany({
      where: {
        OR: [
          { clientId: ctx.clientId },
          clientBookingIds.length > 0 ? { bookingId: { in: clientBookingIds } } : { bookingId: '__none__' },
        ],
      },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        bookingId: true,
        paymentIntentId: true,
        currency: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const invoices = unpaidBookings.map((b: any) => {
      const sitter = b.sitter;
      const sitterName = sitter
        ? `${sitter.firstName || ''} ${sitter.lastName || ''}`.trim()
        : null;
      return {
        id: b.id,
        service: b.service,
        startAt: b.startAt instanceof Date ? b.startAt.toISOString() : b.startAt,
        totalPrice: b.totalPrice,
        paymentLink: b.stripePaymentLinkUrl,
        paymentStatus: b.paymentStatus,
        sitterName,
      };
    });

    const payments = (paymentHistory || []).map((p: any) => ({
      id: p.id,
      amount: p.amount / 100,
      status: p.status,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      bookingId: p.bookingId,
    }));

    const bookingById = new Map((clientBookings || []).map((b) => [b.id, b]));
    const paidCompletions = (paymentHistory || [])
      .filter((p: any) => p.status === 'succeeded')
      .map((p: any) => {
        const booking = p.bookingId ? bookingById.get(p.bookingId) : null;
        return {
          status: 'paid',
          amount: Number(p.amount) / 100,
          paidAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
          bookingReference: p.bookingId ?? null,
          bookingService: booking?.service ?? null,
          bookingStartAt:
            booking?.startAt instanceof Date
              ? booking.startAt.toISOString()
              : booking?.startAt ?? null,
          invoiceReference: p.id,
          paymentIntentId: p.paymentIntentId ?? null,
          currency: p.currency || 'usd',
          receiptLink: null,
          bookingPaymentStatus: booking?.paymentStatus ?? null,
        };
      })
      .sort((a, b) => (new Date(b.paidAt).getTime() || 0) - (new Date(a.paidAt).getTime() || 0))
      .slice(0, 10);

    return NextResponse.json({
      invoices,
      payments,
      paidCompletions,
      loyalty: loyalty
        ? { points: loyalty.points, tier: loyalty.tier }
        : { points: 0, tier: 'bronze' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load billing', message },
      { status: 500 }
    );
  }
}
