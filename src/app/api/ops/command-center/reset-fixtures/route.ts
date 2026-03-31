import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireOwnerOrAdmin } from '@/lib/rbac';
import { getRuntimeEnvName } from '@/lib/runtime-env';
import { checkRateLimit, getRateLimitIdentifier, rateLimitResponse } from '@/lib/rate-limit';
import { logEvent } from '@/lib/log-event';

function isFixtureCalendarEvent(event: { eventType: string; automationType: string | null; error: string | null }) {
  const eventType = event.eventType?.toLowerCase() ?? '';
  const automationType = event.automationType?.toLowerCase() ?? '';
  const error = event.error?.toLowerCase() ?? '';
  return eventType.includes('calendar') || automationType.includes('calendar') || error.includes('calendar');
}

export async function POST(request: NextRequest) {
  const envName = getRuntimeEnvName();
  if (envName === 'prod') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let runId: string | undefined;
  try {
    const body = (await request.json()) as { runId?: string };
    if (body?.runId && /^[a-zA-Z0-9_-]{6,64}$/.test(body.runId)) {
      runId = body.runId;
    }
  } catch {
    // empty body allowed
  }

  const ip = getRateLimitIdentifier(request);
  const providedKey = request.headers.get('x-e2e-key');
  const expectedKey = process.env.E2E_AUTH_KEY;
  const hasValidE2eBypass = !!providedKey && !!expectedKey && providedKey === expectedKey;
  if (providedKey && expectedKey && !hasValidE2eBypass) {
    return NextResponse.json({ error: 'Invalid x-e2e-key' }, { status: 401 });
  }

  let orgId = process.env.PERSONAL_ORG_ID || 'default';
  let actorUserId: string | undefined = hasValidE2eBypass ? 'e2e-key' : undefined;

  if (!hasValidE2eBypass) {
    try {
      const ctx = await getRequestContext();
      requireOwnerOrAdmin(ctx);
      orgId = ctx.orgId;
      actorUserId = ctx.userId ?? undefined;
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const rate = await checkRateLimit(`${orgId}:${ip}`, {
    keyPrefix: 'ops-reset-fixtures',
    limit: 2,
    windowSec: 60,
  });
  if (!rate.success) return rateLimitResponse(rate.retryAfter);

  try {
    const fixtureEvents = await prisma.eventLog.findMany({
      where: {
        orgId,
        ...(runId
          ? {
              OR: [
                { error: { contains: `[run:${runId}]` } },
                { metadata: { contains: `"runId":"${runId}"` } },
              ],
            }
          : {
              OR: [
                { error: { contains: 'Fixture:' } },
                { eventType: { startsWith: 'ops.command_center.seed_fixtures' } },
              ],
            }),
      },
      select: {
        id: true,
        bookingId: true,
        eventType: true,
        automationType: true,
        error: true,
      },
    });

    const fixtureBookings = await prisma.booking.findMany({
      where: {
        orgId,
        ...(runId
          ? { email: { startsWith: `fixture-${runId}-` } }
          : { email: { startsWith: 'fixture-' } }),
      },
      select: { id: true },
    });

    const fixtureBookingIds = fixtureBookings.map((booking) => booking.id);
    const fixtureEventIds = fixtureEvents.map((event) => event.id);
    const fixturePayoutTransfers = await prisma.payoutTransfer.findMany({
      where: {
        orgId,
        OR: [
          ...(runId
            ? [{ lastError: { contains: `[run:${runId}]` as string } }]
            : [{ lastError: { contains: 'Fixture:' as string } }]),
          ...(fixtureBookingIds.length > 0 ? [{ bookingId: { in: fixtureBookingIds } }] : []),
        ],
      },
      select: { id: true },
    });
    const fixturePayoutTransferIds = fixturePayoutTransfers.map((transfer) => transfer.id);

    const itemKeys = new Set<string>();
    for (const event of fixtureEvents) {
      const type = isFixtureCalendarEvent(event) ? 'calendar_repair' : 'automation_failure';
      itemKeys.add(`${type}:${event.bookingId ?? event.id}`);
    }
    for (const bookingId of fixtureBookingIds) {
      itemKeys.add(`coverage_gap:${bookingId}`);
      itemKeys.add(`unassigned:${bookingId}`);
    }
    for (const payoutTransferId of fixturePayoutTransferIds) {
      itemKeys.add(`payout_failure:${payoutTransferId}`);
    }

    await prisma.commandCenterAttentionState.deleteMany({
      where: {
        orgId,
        OR: [
          { itemKey: { in: Array.from(itemKeys) } },
          { updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        ],
      },
    });
    await prisma.eventLog.deleteMany({
      where: {
        orgId,
        id: { in: fixtureEventIds },
      },
    });
    await prisma.booking.deleteMany({
      where: {
        orgId,
        id: { in: fixtureBookingIds },
      },
    });
    await prisma.payoutTransfer.deleteMany({
      where: {
        orgId,
        id: { in: fixturePayoutTransferIds },
      },
    });

    await logEvent({
      orgId,
      actorUserId,
      action: 'ops.command_center.reset_fixtures',
      status: 'success',
      metadata: {
        actor: actorUserId ?? 'anonymous',
        ip,
        deletedBookingCount: fixtureBookingIds.length,
        deletedEventCount: fixtureEventIds.length,
        deletedPayoutTransferCount: fixturePayoutTransferIds.length,
        clearedAttentionStateKeys: itemKeys.size,
        runId: runId ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      deletedBookingCount: fixtureBookingIds.length,
      deletedEventCount: fixtureEventIds.length,
      deletedPayoutTransferCount: fixturePayoutTransferIds.length,
      clearedAttentionStateKeys: itemKeys.size,
      runId: runId ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await logEvent({
      orgId,
      actorUserId,
      action: 'ops.command_center.reset_fixtures',
      status: 'failed',
      metadata: { actor: actorUserId ?? 'anonymous', ip, message },
    });
    return NextResponse.json({ error: 'Failed to reset fixtures', message }, { status: 500 });
  }
}
