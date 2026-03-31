/**
 * GET /api/ops/finance/summary
 * Returns revenue summary, unpaid invoices, and recent payments.
 */

import { NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getScopedDb(ctx);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const [
      monthCharges,
      allTimeCharges,
      unpaidBookings,
      recentCharges,
      monthTips,
      allTimeTips,
    ] = await Promise.all([
      // This month's collected revenue (net of refunds)
      db.stripeCharge.aggregate({
        where: { status: 'succeeded', createdAt: { gte: monthStart } },
        _sum: { amount: true, amountRefunded: true },
      }),
      // All-time collected (net of refunds)
      db.stripeCharge.aggregate({
        where: { status: 'succeeded' },
        _sum: { amount: true, amountRefunded: true },
      }),
      // Unpaid bookings
      db.booking.findMany({
        where: {
          paymentStatus: { not: 'paid' },
          status: { not: 'cancelled' },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          service: true,
          totalPrice: true,
          stripePaymentLinkUrl: true,
          createdAt: true,
          sitter: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
      // Recent payments
      db.stripeCharge.findMany({
        where: { status: 'succeeded' },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          bookingId: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      // Tip revenue this month (from LedgerEntry where sitterId is set, no bookingId — indicates tip)
      db.ledgerEntry.aggregate({
        where: {
          entryType: 'charge',
          sitterId: { not: null },
          bookingId: null,
          status: 'succeeded',
          occurredAt: { gte: monthStart },
        },
        _sum: { amountCents: true },
        _count: { id: true },
      }),
      // All-time tip revenue
      db.ledgerEntry.aggregate({
        where: {
          entryType: 'charge',
          sitterId: { not: null },
          bookingId: null,
          status: 'succeeded',
        },
        _sum: { amountCents: true },
        _count: { id: true },
      }),
    ]);

    const grossThisMonth = (monthCharges._sum?.amount ?? 0) / 100;
    const refundedThisMonth = (monthCharges._sum?.amountRefunded ?? 0) / 100;
    const totalCollectedThisMonth = grossThisMonth - refundedThisMonth;
    const grossAllTime = (allTimeCharges._sum?.amount ?? 0) / 100;
    const refundedAllTime = (allTimeCharges._sum?.amountRefunded ?? 0) / 100;
    const totalCollectedAllTime = grossAllTime - refundedAllTime;
    const tipRevenueThisMonth = (monthTips._sum?.amountCents ?? 0) / 100;
    const tipRevenueAllTime = (allTimeTips._sum?.amountCents ?? 0) / 100;
    const tipCountThisMonth = monthTips._count?.id ?? 0;
    const tipCountAllTime = allTimeTips._count?.id ?? 0;
    const totalOutstanding = unpaidBookings.reduce((s, b) => s + (b.totalPrice || 0), 0);
    const outstandingCount = unpaidBookings.length;

    // Collection rate = paid / (paid + outstanding)
    const totalBilled = totalCollectedAllTime + totalOutstanding;
    const collectionRate = totalBilled > 0 ? Math.round((totalCollectedAllTime / totalBilled) * 100) : 100;

    // Look up booking details for recent charges
    const chargeBookingIds = recentCharges
      .map((c: any) => c.bookingId)
      .filter(Boolean) as string[];
    const chargeBookings = chargeBookingIds.length
      ? await db.booking.findMany({
          where: { id: { in: chargeBookingIds } },
          select: { id: true, firstName: true, lastName: true, service: true },
        })
      : [];
    const chargeBookingMap = new Map(chargeBookings.map((b: any) => [b.id, b]));

    // Count reminders per booking
    const unpaidIds = unpaidBookings.map((b) => b.id);
    const reminderCounts = unpaidIds.length
      ? await db.eventLog.groupBy({
          by: ['bookingId'],
          where: {
            bookingId: { in: unpaidIds },
            eventType: 'payment.reminder.sent',
          },
          _count: { id: true },
        })
      : [];
    const reminderMap = new Map(
      reminderCounts.map((r: any) => [r.bookingId, r._count?.id ?? 0])
    );

    return NextResponse.json({
      totalCollectedThisMonth: Math.round(totalCollectedThisMonth * 100) / 100,
      totalCollectedAllTime: Math.round(totalCollectedAllTime * 100) / 100,
      totalRefundedThisMonth: Math.round(refundedThisMonth * 100) / 100,
      totalRefundedAllTime: Math.round(refundedAllTime * 100) / 100,
      tipRevenueThisMonth: Math.round(tipRevenueThisMonth * 100) / 100,
      tipRevenueAllTime: Math.round(tipRevenueAllTime * 100) / 100,
      tipCountThisMonth,
      tipCountAllTime,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      outstandingCount,
      collectionRate,
      recentPayments: recentCharges.map((c: any) => {
        const bk = c.bookingId ? chargeBookingMap.get(c.bookingId) : null;
        return {
          chargeId: c.id,
          bookingId: c.bookingId || null,
          amount: c.amount / 100,
          clientName: bk
            ? `${bk.firstName || ''} ${bk.lastName || ''}`.trim()
            : 'Unknown',
          service: bk?.service || 'Payment',
          paidAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
        };
      }),
      unpaidInvoices: unpaidBookings.map((b: any) => ({
        bookingId: b.id,
        clientName: `${b.firstName || ''} ${b.lastName || ''}`.trim(),
        clientPhone: b.phone || '',
        service: b.service,
        amount: b.totalPrice || 0,
        createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
        daysSinceCreated: Math.floor(
          (now.getTime() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
        paymentLink: b.stripePaymentLinkUrl,
        remindersSent: reminderMap.get(b.id) || 0,
      })),
    }, {
      headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load finance summary', message },
      { status: 500 }
    );
  }
}
