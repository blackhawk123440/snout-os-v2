import { NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole } from '@/lib/rbac';

/**
 * GET /api/sitter/completed-jobs
 * Returns completed bookings (jobs) for the current sitter with breakdown data.
 */
export async function GET() {
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

    const bookings = await db.booking.findMany({
      where: {
        sitterId: ctx.sitterId,
        status: 'completed',
      },
      include: {
        pets: { select: { id: true, name: true, species: true } },
        client: { select: { firstName: true, lastName: true } },
      },
      orderBy: { endAt: 'desc' },
      take: 50,
    });

    // Load per-booking earnings (includes tips) from SitterEarning
    const bookingIds = bookings.map((b) => b.id);
    const earningRecords = bookingIds.length > 0
      ? await db.sitterEarning.findMany({
          where: { sitterId: ctx.sitterId, bookingId: { in: bookingIds } },
          select: { bookingId: true, tips: true, netAmount: true, platformFee: true },
        })
      : [];
    const earningsByBooking = new Map(earningRecords.map((e: any) => [e.bookingId, e]));

    const toIso = (d: Date) => (d instanceof Date ? d.toISOString() : String(d));
    const payload = bookings.map((b) => {
      const base = b.totalPrice ?? 0;
      const earning = earningsByBooking.get(b.id);
      const tip = earning?.tips ?? 0;
      const addOns = 0; // No add-on model yet
      const gross = base + tip + addOns;
      const afterSplit = earning?.netAmount ?? (gross * (commissionPct / 100));

      return {
        id: b.id,
        service: b.service,
        startAt: toIso(b.startAt),
        endAt: toIso(b.endAt),
        clientName: `${b.client?.firstName || ''} ${b.client?.lastName || ''}`.trim() || 'Client',
        pets: b.pets || [],
        base: Math.round(base * 100) / 100,
        tip: Math.round(tip * 100) / 100,
        addOns,
        gross: Math.round(gross * 100) / 100,
        afterSplit: Math.round(afterSplit * 100) / 100,
        commissionPercentage: commissionPct,
      };
    });

    return NextResponse.json({ jobs: payload });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load completed jobs', message },
      { status: 500 }
    );
  }
}
