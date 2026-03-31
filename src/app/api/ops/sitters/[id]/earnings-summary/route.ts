import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sitterId } = await params;
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const db = getScopedDb(ctx);

  try {
    const sitter = await db.sitter.findFirst({
      where: { id: sitterId },
      select: { firstName: true, lastName: true, email: true, phone: true },
    });
    if (!sitter) return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });

    const completedBookings = await db.booking.findMany({
      where: { sitterId, status: 'completed', startAt: { gte: yearStart, lt: yearEnd } },
      select: { totalPrice: true },
    });

    const totalEarnings = completedBookings.reduce((s: number, b: any) => s + (b.totalPrice || 0), 0);
    const bookingCount = completedBookings.length;

    // Payouts from ledger
    const payouts = await db.ledgerEntry.aggregate({
      where: { sitterId, entryType: 'payout', occurredAt: { gte: yearStart, lt: yearEnd }, status: 'succeeded' },
      _sum: { amountCents: true },
    });
    const totalPayouts = (payouts._sum?.amountCents || 0) / 100;

    return NextResponse.json({
      year,
      sitterName: `${sitter.firstName} ${sitter.lastName}`.trim(),
      email: sitter.email,
      phone: sitter.phone,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalPayouts: Math.round(totalPayouts * 100) / 100,
      bookingCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}
