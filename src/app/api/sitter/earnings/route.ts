import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';

/**
 * GET /api/sitter/earnings
 * Returns earnings summary for the current sitter. Requires SITTER role.
 * Optional query params: from, to (ISO date strings) for custom period filtering.
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter profile missing on session' }, { status: 403 });
  }

  try {
    const db = getScopedDb(ctx);

    const sitter = await db.sitter.findUnique({
      where: { id: ctx.sitterId },
      select: { commissionPercentage: true },
    });

    if (!sitter) {
      return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });
    }

    const commissionPct = sitter.commissionPercentage ?? 80;

    // Optional custom period
    const fromParam = request.nextUrl.searchParams.get('from');
    const toParam = request.nextUrl.searchParams.get('to');
    let periodFrom: Date | null = null;
    let periodTo: Date | null = null;

    if (fromParam) {
      periodFrom = new Date(fromParam);
      if (isNaN(periodFrom.getTime())) {
        return NextResponse.json({ error: 'Invalid "from" date' }, { status: 400 });
      }
      periodTo = toParam ? new Date(toParam) : new Date();
      if (isNaN(periodTo.getTime())) {
        return NextResponse.json({ error: 'Invalid "to" date' }, { status: 400 });
      }
      if (periodFrom > periodTo) {
        return NextResponse.json({ error: '"from" must be before "to"' }, { status: 400 });
      }
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const queries: Promise<any>[] = [
      db.booking.aggregate({
        where: { sitterId: ctx.sitterId, status: 'completed' },
        _sum: { totalPrice: true },
        _count: true,
      }),
      db.booking.aggregate({
        where: { sitterId: ctx.sitterId, status: 'completed', endAt: { gte: startOfMonth } },
        _sum: { totalPrice: true },
        _count: true,
      }),
      db.booking.aggregate({
        where: { sitterId: ctx.sitterId, status: 'completed', endAt: { gte: startOfLastMonth, lt: startOfMonth } },
        _sum: { totalPrice: true },
        _count: true,
      }),
    ];

    if (periodFrom && periodTo) {
      queries.push(
        db.booking.aggregate({
          where: { sitterId: ctx.sitterId, status: 'completed', endAt: { gte: periodFrom, lte: periodTo } },
          _sum: { totalPrice: true },
          _count: true,
        })
      );
    }

    // Query tip totals from SitterEarning
    queries.push(
      db.sitterEarning.aggregate({
        where: { sitterId: ctx.sitterId },
        _sum: { tips: true },
      })
    );

    queries.push(
      (db as any).payoutTransfer.findMany({
        where: { sitterId: ctx.sitterId },
        select: { bookingId: true, status: true },
      })
    );

    queries.push(
      db.booking.findMany({
        where: {
          sitterId: ctx.sitterId,
          status: 'completed',
          paymentStatus: 'paid',
        },
        select: {
          id: true,
          totalPrice: true,
          updatedAt: true,
        },
      })
    );

    const results = await Promise.all(queries);
    const [completedAll, completedThisMonth, completedLastMonth] = results;
    const completedPeriod = periodFrom ? results[3] : null;
    const tipAgg = periodFrom ? results[4] : results[3];
    const payoutTransfers = (periodFrom ? results[5] : results[4]) as Array<{ bookingId?: string | null; status?: string | null }>;
    const paidCompletedBookings = (periodFrom ? results[6] : results[5]) as Array<{
      id: string;
      totalPrice: number | null;
      updatedAt: Date | string;
    }>;

    const tipsTotal = tipAgg?._sum?.tips ?? 0;
    const grossTotal = completedAll._sum.totalPrice ?? 0;
    const grossThisMonth = completedThisMonth._sum.totalPrice ?? 0;
    const grossLastMonth = completedLastMonth._sum.totalPrice ?? 0;
    const earningsTotal = grossTotal * (commissionPct / 100);
    const earningsThisMonth = grossThisMonth * (commissionPct / 100);
    const earningsLastMonth = grossLastMonth * (commissionPct / 100);

    const completedCount = completedAll._count;
    const avgPerVisit = completedCount > 0 ? earningsTotal / completedCount : 0;
    const existingTransferBookingIds = new Set(
      (payoutTransfers || [])
        .map((transfer) => transfer.bookingId)
        .filter((bookingId): bookingId is string => !!bookingId)
    );
    const scheduledPayoutBookings = (paidCompletedBookings || []).filter(
      (booking) => !existingTransferBookingIds.has(booking.id)
    );
    const scheduledPayoutAmount = scheduledPayoutBookings.reduce((sum, booking) => {
      const totalPrice = Number(booking.totalPrice ?? 0);
      return sum + totalPrice * (commissionPct / 100);
    }, 0);
    const nextPayoutReleaseAt = scheduledPayoutBookings.length > 0
      ? new Date(
          Math.min(
            ...scheduledPayoutBookings.map((booking) => {
              const completedAt = new Date(booking.updatedAt);
              return completedAt.getTime() + (7 * 24 * 60 * 60 * 1000);
            })
          )
        ).toISOString()
      : null;

    const response: Record<string, any> = {
      commissionPercentage: commissionPct,
      grossTotal: Math.round(grossTotal * 100) / 100,
      earningsTotal: Math.round(earningsTotal * 100) / 100,
      grossThisMonth: Math.round(grossThisMonth * 100) / 100,
      earningsThisMonth: Math.round(earningsThisMonth * 100) / 100,
      grossLastMonth: Math.round(grossLastMonth * 100) / 100,
      earningsLastMonth: Math.round(earningsLastMonth * 100) / 100,
      completedBookingsCount: completedCount,
      completedThisMonthCount: completedThisMonth._count,
      completedLastMonthCount: completedLastMonth._count,
      averagePerVisit: Math.round(avgPerVisit * 100) / 100,
      tipsTotal: Math.round(tipsTotal * 100) / 100,
      scheduledPayoutAmount: Math.round(scheduledPayoutAmount * 100) / 100,
      scheduledPayoutCount: scheduledPayoutBookings.length,
      nextPayoutReleaseAt,
    };

    if (completedPeriod) {
      const periodGross = completedPeriod._sum.totalPrice ?? 0;
      response.periodGross = Math.round(periodGross * 100) / 100;
      response.periodEarnings = Math.round(periodGross * (commissionPct / 100) * 100) / 100;
      response.periodCount = completedPeriod._count;
    }

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load earnings', message },
      { status: 500 }
    );
  }
}
