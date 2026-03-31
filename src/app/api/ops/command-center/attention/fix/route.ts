import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireOwnerOrAdmin } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { enqueueAutomation } from '@/lib/automation-queue';
import { enqueueCalendarSync } from '@/lib/calendar-queue';
import { enqueuePayoutForBooking } from '@/lib/payout/payout-queue';

type FixType = 'automation_failure' | 'calendar_repair' | 'payout_failure';

function parseItemId(itemId: string): { type: FixType | null; entityId: string | null } {
  const [rawType, entityId] = itemId.split(':', 2);
  if (!entityId) return { type: null, entityId: null };
  if (rawType === 'automation_failure' || rawType === 'calendar_repair' || rawType === 'payout_failure') {
    return { type: rawType, entityId };
  }
  return { type: null, entityId: null };
}

function isCalendarEvent(event: { eventType: string; automationType: string | null; error: string | null }) {
  const eventType = event.eventType?.toLowerCase() ?? '';
  const automationType = event.automationType?.toLowerCase() ?? '';
  const errorText = event.error?.toLowerCase() ?? '';
  return (
    eventType.includes('calendar') ||
    automationType.includes('calendar') ||
    errorText.includes('calendar')
  );
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    const body = (await request.json()) as { itemId?: string };
    const itemId = (body.itemId || '').trim();
    const parsed = parseItemId(itemId);
    if (!itemId || !parsed.type || !parsed.entityId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    if (parsed.type === 'automation_failure') {
      const event = await db.eventLog.findFirst({
        where: {
          AND: [
            {
              OR: [{ id: parsed.entityId }, { bookingId: parsed.entityId }],
            },
            {
              OR: [
                { eventType: 'automation.failed' },
                { eventType: 'automation.dead' },
                { status: 'failed' },
              ],
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!event || isCalendarEvent(event)) {
        return NextResponse.json({ error: 'Automation failure event not found' }, { status: 404 });
      }

      const metadata = event.metadata
        ? typeof event.metadata === 'string'
          ? JSON.parse(event.metadata)
          : event.metadata
        : {};
      const { automationType, recipient, context, jobId } = metadata ?? {};
      if (!automationType || !recipient || !context) {
        return NextResponse.json({ error: 'Retry metadata missing on automation event' }, { status: 409 });
      }

      const idempotencyKey = jobId || `cc-fix:${event.id}`;
      await enqueueAutomation(automationType, recipient, context, idempotencyKey, ctx.correlationId);
      const actionEvent = await db.eventLog.create({
        data: {
          orgId: ctx.orgId,
          eventType: 'ops.automation.retry_queued',
          status: 'success',
          bookingId: event.bookingId ?? null,
          metadata: JSON.stringify({
            actorUserId: ctx.userId ?? 'system',
            itemId,
            eventLogId: event.id,
            idempotencyKey,
            correlationId: ctx.correlationId,
          }),
        },
      });
      await db.commandCenterAttentionState.upsert({
        where: { orgId_itemKey: { orgId: ctx.orgId, itemKey: itemId } },
        create: {
          orgId: ctx.orgId,
          itemKey: itemId,
          handledAt: new Date(),
        },
        update: {
          handledAt: new Date(),
          snoozedUntil: null,
        },
      });

      return NextResponse.json({
        ok: true,
        itemId,
        type: parsed.type,
        queued: true,
        idempotencyKey,
        actionEventLogId: actionEvent.id,
        actionEventType: actionEvent.eventType,
      });
    }

    if (parsed.type === 'payout_failure') {
      const transfer = await db.payoutTransfer.findFirst({
        where: { id: parsed.entityId },
        select: {
          id: true,
          orgId: true,
          sitterId: true,
          bookingId: true,
          status: true,
          stripeTransferId: true,
          lastError: true,
        },
      });
      if (!transfer) {
        return NextResponse.json({ error: 'Payout transfer not found' }, { status: 404 });
      }
      const safeToRetry = !!transfer.bookingId && !transfer.stripeTransferId && transfer.status === 'failed';
      if (!safeToRetry) {
        return NextResponse.json(
          {
            error: 'Payout retry is unsafe for this transfer',
            safeToRetry: false,
            reason: !transfer.bookingId
              ? 'No booking associated with this transfer'
              : 'Transfer has external metadata and requires manual review',
          },
          { status: 409 }
        );
      }
      const bookingId = transfer.bookingId as string;

      await enqueuePayoutForBooking({
        orgId: ctx.orgId,
        bookingId,
        sitterId: transfer.sitterId,
        correlationId: ctx.correlationId,
      });
      const actionEvent = await db.eventLog.create({
        data: {
          orgId: ctx.orgId,
          eventType: 'ops.payout.retry_queued',
          status: 'success',
          bookingId,
          metadata: JSON.stringify({
            actorUserId: ctx.userId ?? 'system',
            itemId,
            payoutTransferId: transfer.id,
            sitterId: transfer.sitterId,
            bookingId,
            correlationId: ctx.correlationId,
          }),
        },
      });
      await db.commandCenterAttentionState.upsert({
        where: { orgId_itemKey: { orgId: ctx.orgId, itemKey: itemId } },
        create: {
          orgId: ctx.orgId,
          itemKey: itemId,
          handledAt: new Date(),
        },
        update: {
          handledAt: new Date(),
          snoozedUntil: null,
        },
      });
      return NextResponse.json({
        ok: true,
        itemId,
        type: parsed.type,
        queued: true,
        actionEventLogId: actionEvent.id,
        actionEventType: actionEvent.eventType,
      });
    }

    const event = await db.eventLog.findFirst({
      where: {
        OR: [{ id: parsed.entityId }, { bookingId: parsed.entityId }],
        status: 'failed',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!event || !isCalendarEvent(event)) {
      return NextResponse.json({ error: 'Calendar repair event not found' }, { status: 404 });
    }

    const metadata = event.metadata
      ? typeof event.metadata === 'string'
        ? JSON.parse(event.metadata)
        : event.metadata
      : {};
    const sitterId = typeof metadata?.sitterId === 'string' ? metadata.sitterId : null;
    if (!sitterId) {
      return NextResponse.json({ error: 'Calendar repair requires sitterId metadata' }, { status: 409 });
    }

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    const end = new Date(now);
    end.setDate(end.getDate() + 14);
    const jobId = await enqueueCalendarSync({
      type: 'syncRange',
      sitterId,
      start: start.toISOString(),
      end: end.toISOString(),
      orgId: ctx.orgId,
      correlationId: ctx.correlationId,
    });
    const actionEvent = await db.eventLog.create({
      data: {
        orgId: ctx.orgId,
        eventType: 'calendar.repair.requested',
        status: 'success',
        bookingId: event.bookingId ?? null,
        metadata: JSON.stringify({
          actorUserId: ctx.userId ?? 'system',
          itemId,
          eventLogId: event.id,
          sitterId,
          jobId,
          correlationId: ctx.correlationId,
        }),
      },
    });
    await db.commandCenterAttentionState.upsert({
      where: { orgId_itemKey: { orgId: ctx.orgId, itemKey: itemId } },
      create: {
        orgId: ctx.orgId,
        itemKey: itemId,
        handledAt: new Date(),
      },
      update: {
        handledAt: new Date(),
        snoozedUntil: null,
      },
    });

    return NextResponse.json({
      ok: true,
      itemId,
      type: parsed.type,
      queued: true,
      jobId,
      actionEventLogId: actionEvent.id,
      actionEventType: actionEvent.eventType,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to queue fix action', message }, { status: 500 });
  }
}
