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
    const userDb = db.user as any;
    const [unpaidBookings, clientBookings, loyalty, referralUser] = await Promise.all([
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
      userDb.findUnique({
        where: { id: ctx.userId },
        select: { referralCode: true },
      }).catch(() => null),
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

    const availablePoints = loyalty?.points ?? 0;
    const redeemablePoints = Math.floor(availablePoints / 100) * 100;
    const redeemableDiscount = (redeemablePoints / 100) * 5;
    const referralCode = referralUser?.referralCode ?? null;
    let referralCount = 0;
    let qualifiedReferralCount = 0;

    if (referralCode) {
      const referredUsers = await userDb.findMany({
        where: { referredBy: referralCode },
        select: { clientId: true },
      }).catch(() => []);

      referralCount = referredUsers.length;

      const referredClientIds = referredUsers
        .map((user: { clientId?: string | null }) => user.clientId)
        .filter((clientId: string | null | undefined): clientId is string => !!clientId);

      if (referredClientIds.length > 0) {
        const qualifiedBookings = await db.booking.findMany({
          where: {
            clientId: { in: referredClientIds },
            paymentStatus: 'paid',
            status: { in: ['confirmed', 'completed'] },
          },
          select: { clientId: true },
        });

        qualifiedReferralCount = new Set(
          qualifiedBookings
            .map((booking) => booking.clientId)
            .filter((clientId): clientId is string => !!clientId)
        ).size;
      }
    }

    return NextResponse.json({
      invoices,
      payments,
      paidCompletions,
      loyalty: loyalty
        ? { points: loyalty.points, tier: loyalty.tier }
        : { points: 0, tier: 'bronze' },
      loyaltySummary: {
        availablePoints,
        redeemablePoints,
        redeemableDiscount,
      },
      referrals: {
        referralCode,
        referralCount,
        qualifiedReferralCount,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load billing', message },
      { status: 500 }
    );
  }
}
