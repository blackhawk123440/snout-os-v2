import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { logEvent } from '@/lib/log-event';

const BulkCancelSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.enum(['weather', 'emergency', 'owner_decision', 'other']),
  notifyClients: z.boolean().default(true),
  notifySitters: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = BulkCancelSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const { date, reason, notifyClients, notifySitters } = parsed.data;
    const dayStart = new Date(date + 'T00:00:00');
    const dayEnd = new Date(date + 'T23:59:59.999');

    const db = getScopedDb(ctx);

    const bookings = await db.booking.findMany({
      where: {
        startAt: { gte: dayStart, lte: dayEnd },
        status: { in: ['pending', 'confirmed'] },
      },
      select: {
        id: true, sitterId: true, clientId: true, service: true, startAt: true,
        firstName: true, lastName: true, paymentStatus: true,
      },
    });

    let cancelled = 0;
    for (const booking of bookings) {
      await db.booking.update({
        where: { id: booking.id },
        data: { status: 'cancelled' },
      });

      await db.bookingStatusHistory.create({
        data: {
          orgId: ctx.orgId,
          bookingId: booking.id,
          fromStatus: 'confirmed',
          toStatus: 'cancelled',
          changedBy: ctx.userId ?? null,
          reason: `bulk_cancel:${reason}`,
        },
      });

      // Notify sitter
      if (notifySitters && booking.sitterId) {
        void import('@/lib/notifications/triggers').then(({ notifySitterBookingCancelled }) => {
          notifySitterBookingCancelled({
            orgId: ctx.orgId,
            bookingId: booking.id,
            sitterId: booking.sitterId!,
            clientName: `${booking.firstName} ${booking.lastName}`.trim(),
            service: booking.service,
            startAt: booking.startAt,
          });
        }).catch(() => {});
      }

      cancelled++;
    }

    await logEvent({
      orgId: ctx.orgId,
      action: 'bookings.bulk_cancelled',
      status: 'success',
      metadata: { date, reason, cancelled, total: bookings.length },
    });

    return NextResponse.json({
      cancelled,
      total: bookings.length,
      date,
      reason,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}
