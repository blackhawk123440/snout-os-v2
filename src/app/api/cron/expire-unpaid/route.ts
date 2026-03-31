import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logEvent } from '@/lib/log-event';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (!expectedKey || !authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find bookings that are pending_payment past their deadline
    const expired = await (prisma as any).booking.findMany({
      where: {
        status: 'pending_payment',
        paymentDeadline: { lt: now },
      },
      select: { id: true, orgId: true },
    });

    let expiredCount = 0;
    const errors: Array<{ bookingId: string; error: string }> = [];

    for (const booking of expired) {
      try {
        await (prisma as any).booking.update({
          where: { id: booking.id },
          data: { status: 'expired', paymentStatus: 'unpaid' },
        });

        await (prisma as any).bookingStatusHistory.create({
          data: {
            orgId: booking.orgId,
            bookingId: booking.id,
            fromStatus: 'pending_payment',
            toStatus: 'expired',
            changedBy: 'cron',
            reason: 'payment_deadline_exceeded',
          },
        });

        await logEvent({
          orgId: booking.orgId,
          action: 'booking.payment_expired',
          bookingId: booking.id,
          status: 'success',
        });

        expiredCount++;
      } catch (bookingError: any) {
        console.error(`[expire-unpaid] Failed to expire booking ${booking.id}:`, bookingError);
        errors.push({ bookingId: booking.id, error: bookingError.message });
      }
    }

    return NextResponse.json({
      success: true,
      expiredCount,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error('[expire-unpaid] ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
