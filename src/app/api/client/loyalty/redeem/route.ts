import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';
import { redeemPoints } from '@/lib/loyalty/loyalty-engine';

/**
 * POST /api/client/loyalty/redeem
 * Redeems loyalty points for account credit.
 * Credit is stored as a negative-amount booking adjustment (discount) applied to next unpaid invoice.
 *
 * Body: { maxPoints?: number } — optional cap on how many points to redeem
 * Returns: { discountDollars, pointsUsed, remainingPoints, appliedToBookingId? }
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const maxPoints = typeof body.maxPoints === 'number' ? body.maxPoints : undefined;

    const db = getScopedDb(ctx);
    const result = await redeemPoints(db as any, ctx.orgId, ctx.clientId!, maxPoints);

    if (result.discountDollars <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Not enough points to redeem (minimum 100 points)',
        currentPoints: result.remainingPoints,
      }, { status: 400 });
    }

    // Apply discount to the oldest unpaid booking as a price reduction
    let appliedToBookingId: string | null = null;
    const unpaidBooking = await db.booking.findFirst({
      where: {
        clientId: ctx.clientId,
        paymentStatus: { not: 'paid' },
        status: { not: 'cancelled' },
      },
      select: { id: true, totalPrice: true },
      orderBy: { startAt: 'asc' },
    });

    if (unpaidBooking) {
      const currentPrice = Number(unpaidBooking.totalPrice) || 0;
      const newPrice = Math.max(0, currentPrice - result.discountDollars);
      await db.booking.update({
        where: { id: unpaidBooking.id },
        data: { totalPrice: newPrice },
      });
      appliedToBookingId = unpaidBooking.id;

      // Log the application
      await db.eventLog.create({
        data: {
          orgId: ctx.orgId,
          eventType: 'loyalty.discount_applied',
          status: 'success',
          bookingId: unpaidBooking.id,
          metadata: JSON.stringify({
            clientId: ctx.clientId,
            discountDollars: result.discountDollars,
            pointsUsed: result.pointsUsed,
            previousPrice: currentPrice,
            newPrice,
          }),
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      discountDollars: result.discountDollars,
      pointsUsed: result.pointsUsed,
      remainingPoints: result.remainingPoints,
      appliedToBookingId,
      message: appliedToBookingId
        ? `$${result.discountDollars} discount applied to booking`
        : `$${result.discountDollars} credit earned — will apply to your next booking`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Redemption failed', message: msg }, { status: 500 });
  }
}
