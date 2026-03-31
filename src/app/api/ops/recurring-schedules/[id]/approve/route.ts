/**
 * POST /api/ops/recurring-schedules/[id]/approve
 * Owner approves a pending recurring schedule. Activates it and generates bookings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { generateRecurringBookings } from '@/lib/recurring/generate';
import { logEvent } from '@/lib/log-event';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'approve'; // approve or deny

    const db = getScopedDb(ctx);
    const schedule = await db.recurringSchedule.findUnique({ where: { id } });
    if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });

    if (action === 'deny') {
      await db.recurringSchedule.update({ where: { id }, data: { status: 'cancelled' } });
      await logEvent({ orgId: ctx.orgId, action: 'recurring.denied', entityId: id, status: 'success' }).catch(() => {});

      // Notify client
      try {
        const client = await db.client.findUnique({ where: { id: schedule.clientId }, select: { phone: true, firstName: true } });
        if (client?.phone) {
          const { sendMessage } = await import('@/lib/message-utils');
          void sendMessage(client.phone, `Hi ${client.firstName || 'there'}, your recurring ${schedule.service} request wasn't approved. Please contact us for more details.`);
        }
      } catch {}

      return NextResponse.json({ success: true, status: 'denied' });
    }

    // Approve: activate and generate bookings
    await db.recurringSchedule.update({ where: { id }, data: { status: 'active' } });

    const result = await generateRecurringBookings({
      scheduleId: id,
      orgId: ctx.orgId,
      daysAhead: 28,
    });

    await logEvent({
      orgId: ctx.orgId,
      action: 'recurring.approved',
      entityId: id,
      status: 'success',
      metadata: { bookingsCreated: result.created },
    }).catch(() => {});

    // Notify client
    try {
      const client = await db.client.findUnique({ where: { id: schedule.clientId }, select: { phone: true, firstName: true } });
      if (client?.phone) {
        const { sendMessage } = await import('@/lib/message-utils');
        void sendMessage(client.phone, `Hi ${client.firstName || 'there'}, your recurring ${schedule.service} has been approved! ${result.created} visits have been scheduled.`);
      }
    } catch {}

    return NextResponse.json({
      success: true,
      status: 'active',
      bookingsCreated: result.created,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
