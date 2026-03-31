import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireOwnerOrAdmin } from '@/lib/rbac';
import { getRuntimeEnvName } from '@/lib/runtime-env';
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitResponse,
} from '@/lib/rate-limit';
import { logEvent } from '@/lib/log-event';
import { resolveCorrelationId } from '@/lib/correlation-id';

function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

async function ensureRoleTestAccounts(orgId: string) {
  const assigned = await prisma.booking.findFirst({
    where: { orgId, sitterId: { not: null } },
    select: { sitterId: true },
    orderBy: { createdAt: 'desc' },
  });

  const fixtureEmail = 'fixture-resolve-sitter@example.com';
  const existingFixture = await prisma.sitter.findFirst({
    where: { orgId, email: fixtureEmail },
    select: { id: true },
  });
  const fixtureSitterId = existingFixture?.id
    ? existingFixture.id
    : (
        await prisma.sitter.create({
          data: {
            orgId,
            firstName: 'Fixture',
            lastName: 'Resolve',
            phone: '+15551000099',
            email: fixtureEmail,
            active: true,
          },
          select: { id: true },
        })
      ).id;

  return { sitterId: assigned?.sitterId ?? null, fixtureSitterId };
}

export async function POST(request: NextRequest) {
  const envName = getRuntimeEnvName();
  if (envName === 'prod') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const correlationId = resolveCorrelationId(request);
  const ip = getRateLimitIdentifier(request);

  const providedKey = request.headers.get('x-e2e-key');
  const expectedKey = process.env.E2E_AUTH_KEY;
  if (providedKey && expectedKey && providedKey !== expectedKey) {
    await logEvent({
      orgId: process.env.PERSONAL_ORG_ID || 'default',
      action: 'ops.command_center.seed_fixtures',
      status: 'failed',
      metadata: { actor: 'e2e-key-invalid', ip, reason: 'invalid_key' },
    });
    return NextResponse.json({ error: 'Invalid x-e2e-key' }, { status: 401 });
  }
  const hasValidE2eBypass = !!providedKey && !!expectedKey && providedKey === expectedKey;

  let orgId = process.env.PERSONAL_ORG_ID || 'default';
  let actorUserId: string | undefined = hasValidE2eBypass ? 'e2e-key' : undefined;
  if (!hasValidE2eBypass) {
    let ctx;
    try {
      ctx = await getRequestContext(request);
      requireOwnerOrAdmin(ctx);
      orgId = ctx.orgId;
      actorUserId = ctx.userId ?? undefined;
    } catch (error) {
      await logEvent({
        orgId,
        actorUserId,
        action: 'ops.command_center.seed_fixtures',
        status: 'failed',
        metadata: { actor: actorUserId ?? 'anonymous', ip, reason: 'auth_failed' },
      });
      if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const rate = await checkRateLimit(`${orgId}:${ip}`, {
    keyPrefix: 'ops-seed-fixtures',
    limit: 2,
    windowSec: 60,
  });
  if (!rate.success) {
    await logEvent({
      orgId,
      actorUserId,
      action: 'ops.command_center.seed_fixtures.rate_limited',
      status: 'failed',
      metadata: { actor: actorUserId ?? 'anonymous', ip, retryAfter: rate.retryAfter ?? 60 },
    });
    return rateLimitResponse(rate.retryAfter);
  }

  try {
    let runId = `verify-${Date.now().toString(36)}`;
    try {
      const body = (await request.json()) as { runId?: string };
      if (body?.runId && /^[a-zA-Z0-9_-]{6,64}$/.test(body.runId)) {
        runId = body.runId;
      }
    } catch {
      // empty body is fine; default runId stays
    }

    // Staging hygiene: prune stale handled/snoozed state older than 24h.
    const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.commandCenterAttentionState.deleteMany({
      where: {
        orgId,
        updatedAt: { lt: staleBefore },
      },
    });

    const { sitterId, fixtureSitterId } = await ensureRoleTestAccounts(orgId);
    const now = new Date();

    const overlapA = sitterId
      ? await prisma.booking.create({
      data: {
        orgId,
        firstName: 'Fixture',
        lastName: 'Overlap A',
        phone: '+15551000001',
        email: `fixture-${runId}-overlap-a@example.com`,
        service: 'Dog Walking',
        startAt: addMinutes(now, 240),
        endAt: addMinutes(now, 300),
        totalPrice: 25,
        status: 'confirmed',
        sitterId,
      },
      select: { id: true, startAt: true },
    })
      : null;

    const overlapB = sitterId
      ? await prisma.booking.create({
      data: {
        orgId,
        firstName: 'Fixture',
        lastName: 'Overlap B',
        phone: '+15551000002',
        email: `fixture-${runId}-overlap-b@example.com`,
        service: 'Drop-ins',
        startAt: addMinutes(now, 270),
        endAt: addMinutes(now, 330),
        totalPrice: 30,
        status: 'confirmed',
        sitterId,
      },
      select: { id: true },
    })
      : null;

    const unassignedA = await prisma.booking.create({
      data: {
        orgId,
        firstName: 'Fixture',
        lastName: 'Unassigned A',
        phone: '+15551000003',
        email: `fixture-${runId}-unassigned-a@example.com`,
        service: 'Dog Walking',
        startAt: addMinutes(now, 180),
        endAt: addMinutes(now, 210),
        totalPrice: 20,
        status: 'confirmed',
      },
      select: { id: true },
    });

    const unassignedB = await prisma.booking.create({
      data: {
        orgId,
        firstName: 'Fixture',
        lastName: 'Unassigned B',
        phone: '+15551000004',
        email: `fixture-${runId}-unassigned-b@example.com`,
        service: 'Drop-ins',
        startAt: addMinutes(now, 360),
        endAt: addMinutes(now, 390),
        totalPrice: 22,
        status: 'pending',
      },
      select: { id: true },
    });

    const dedupeBooking = await prisma.booking.create({
      data: {
        orgId,
        firstName: 'Fixture',
        lastName: 'Dedupe Target',
        phone: '+15551000005',
        email: `fixture-${runId}-dedupe@example.com`,
        service: 'Dog Walking',
        startAt: addMinutes(now, 90),
        endAt: addMinutes(now, 120),
        totalPrice: 19,
        status: 'confirmed',
        sitterId: sitterId ?? null,
      },
      select: { id: true },
    });

    const threadAId = randomUUID();
    const threadBId = randomUUID();

    const automationFailedA = await prisma.eventLog.create({
      data: {
        orgId,
        eventType: 'automation.failed',
        automationType: 'bookingConfirmation',
        status: 'failed',
        error: `[run:${runId}] Fixture: booking confirmation failed`,
        bookingId: dedupeBooking.id,
        metadata: JSON.stringify({ runId, correlationId }),
      },
      select: { id: true },
    });
    const automationDead = await prisma.eventLog.create({
      data: {
        orgId,
        eventType: 'automation.dead',
        automationType: 'bookingConfirmation',
        status: 'failed',
        error: `[run:${runId}] Fixture: automation dead-letter event`,
        bookingId: dedupeBooking.id,
        metadata: JSON.stringify({ runId, correlationId }),
      },
      select: { id: true },
    });
    const automationFailedB = await prisma.eventLog.create({
      data: {
        orgId,
        eventType: 'automation.failed',
        automationType: 'bookingConfirmation',
        status: 'failed',
        error: `[run:${runId}] Fixture: retry automation failed`,
        bookingId: dedupeBooking.id,
        metadata: JSON.stringify({
          runId,
          automationType: 'bookingConfirmation',
          recipient: 'owner',
          context: {
            orgId,
            bookingId: dedupeBooking.id,
            source: 'seed-fixtures',
          },
          jobId: `seed-retry-${runId}`,
          correlationId,
        }),
      },
      select: { id: true },
    });

    const messageFailedA = await prisma.eventLog.create({
      data: {
        orgId,
        eventType: 'message.failed',
        status: 'failed',
        error: `[run:${runId}] Fixture: outbound message failed for thread A`,
        metadata: JSON.stringify({ threadId: threadAId, runId, correlationId }),
      },
      select: { id: true },
    });
    const messageFailedB = await prisma.eventLog.create({
      data: {
        orgId,
        eventType: 'message.failed',
        status: 'failed',
        error: `[run:${runId}] Fixture: outbound message failed for thread B`,
        metadata: JSON.stringify({ threadId: threadBId, runId, correlationId }),
      },
      select: { id: true },
    });

    const calendarFailed = await prisma.eventLog.create({
      data: {
        orgId,
        eventType: 'calendar.sync.failed',
        automationType: 'calendarSync',
        status: 'failed',
        error: `[run:${runId}] Fixture: calendar sync failed for sitter`,
        bookingId: overlapA?.id ?? dedupeBooking.id,
        metadata: JSON.stringify({ sitterId: sitterId ?? 'unknown', runId, correlationId }),
      },
      select: { id: true },
    });

    const payoutFailed = await prisma.payoutTransfer.create({
      data: {
        orgId,
        sitterId: fixtureSitterId,
        bookingId: dedupeBooking.id,
        amount: 1900,
        currency: 'usd',
        status: 'failed',
        stripeTransferId: null,
        lastError: `[run:${runId}] Fixture: payout transfer failed`,
      },
      select: { id: true },
    });

    const expectedItemKeys = [
      `automation_failure:${dedupeBooking.id}`,
      `automation_failure:${messageFailedA.id}`,
      `automation_failure:${messageFailedB.id}`,
      `calendar_repair:${overlapA?.id ?? dedupeBooking.id}`,
      `payout_failure:${payoutFailed.id}`,
      `coverage_gap:${unassignedA.id}`,
      `coverage_gap:${unassignedB.id}`,
      `unassigned:${unassignedA.id}`,
      `unassigned:${unassignedB.id}`,
      ...(overlapA && overlapB ? [`overlap:${overlapA.id}_${overlapB.id}`] : []),
    ];

    await logEvent({
      orgId,
      actorUserId,
      action: 'ops.command_center.seed_fixtures',
      status: 'success',
      metadata: {
        actor: actorUserId ?? 'anonymous',
        ip,
        bookingCount: 3 + (overlapA ? 1 : 0) + (overlapB ? 1 : 0),
        eventCount: 6,
        payoutCount: 1,
        runId,
      },
    });

    return NextResponse.json({
      ok: true,
      envName,
      runId,
      created: {
        eventLogIds: [
          automationFailedA.id,
          automationDead.id,
          automationFailedB.id,
          messageFailedA.id,
          messageFailedB.id,
          calendarFailed.id,
        ],
        payoutTransferIds: [payoutFailed.id],
        bookingIds: [
          dedupeBooking.id,
          unassignedA.id,
          unassignedB.id,
          ...(overlapA ? [overlapA.id] : []),
          ...(overlapB ? [overlapB.id] : []),
        ],
        threadIds: [threadAId, threadBId],
        fixtureSitterId,
      },
      expectedItemKeys,
      testAccounts: {
        owner: { email: 'owner@example.com', password: 'e2e-test-password' },
        sitter: { email: 'sitter@example.com', password: 'e2e-test-password' },
        client: { email: 'client@example.com', password: 'e2e-test-password' },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await logEvent({
      orgId,
      actorUserId,
      action: 'ops.command_center.seed_fixtures',
      status: 'failed',
      metadata: { actor: actorUserId ?? 'anonymous', ip, message },
    });
    return NextResponse.json({ error: 'Failed to seed fixtures', message }, { status: 500 });
  }
}
