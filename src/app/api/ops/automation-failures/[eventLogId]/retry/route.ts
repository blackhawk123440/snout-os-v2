/**
 * POST /api/ops/automation-failures/[eventLogId]/retry
 * Re-enqueue automation job. Blocks if idempotency indicates already succeeded.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { enqueueAutomation } from '@/lib/automation-queue';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventLogId: string }> }
) {
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

  const { eventLogId } = await params;
  const db = getScopedDb(ctx);

  try {
    const event = await db.eventLog.findFirst({
      where: { id: eventLogId },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.eventType !== 'automation.failed' && event.eventType !== 'automation.dead') {
      return NextResponse.json(
        { error: 'Only failed or dead automation events can be retried' },
        { status: 400 }
      );
    }

    const metadata = event.metadata
      ? typeof event.metadata === 'string'
        ? JSON.parse(event.metadata)
        : event.metadata
      : {};

    const { automationType, recipient, context, jobId } = metadata;
    if (!automationType || !recipient || !context) {
      return NextResponse.json(
        { error: 'Event missing automation metadata' },
        { status: 400 }
      );
    }

    const idempotencyKey = jobId || `retry:${eventLogId}`;

    const existingSuccess = await db.eventLog.findMany({
      where: {
        eventType: { startsWith: 'automation.run.' },
        status: 'success',
        bookingId: context.bookingId || undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    for (const s of existingSuccess) {
      const successMeta = s.metadata
        ? typeof s.metadata === 'string'
          ? JSON.parse(s.metadata)
          : s.metadata
        : {};
      if (successMeta.jobId === idempotencyKey) {
        return NextResponse.json(
          { error: 'Job already succeeded (idempotency)', blocked: true },
          { status: 409 }
        );
      }
    }

    await enqueueAutomation(automationType, recipient, context, idempotencyKey, ctx.correlationId);

    await db.eventLog.create({
      data: {
        orgId: ctx.orgId,
        eventType: 'ops.automation.retry_queued',
        status: 'success',
        bookingId: event.bookingId ?? null,
        metadata: JSON.stringify({
          actorUserId: ctx.userId ?? 'system',
          eventLogId,
          automationType,
          recipient,
          context,
          idempotencyKey,
          correlationId: ctx.correlationId,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Job re-enqueued',
      idempotencyKey,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await db.eventLog.create({
      data: {
        orgId: ctx.orgId,
        eventType: 'ops.automation.retry_failed',
        status: 'failed',
        bookingId: null,
        error: message,
        metadata: JSON.stringify({
          actorUserId: ctx.userId ?? 'system',
          eventLogId,
          correlationId: ctx.correlationId,
        }),
      },
    }).catch(() => {});
    return NextResponse.json({ error: 'Retry failed', message }, { status: 500 });
  }
}
