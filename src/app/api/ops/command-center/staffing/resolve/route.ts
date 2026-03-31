import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireOwnerOrAdmin } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { forceAssignSitter } from '@/lib/dispatch-control';
import { enqueueCalendarSync } from '@/lib/calendar-queue';
import { logEvent } from '@/lib/log-event';
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitResponse,
} from '@/lib/rate-limit';

type ResolveAction = 'assign_notify' | 'rollback';

type SnapshotAttentionState = {
  handledAt: string | null;
  snoozedUntil: string | null;
} | null;

function parseItemId(itemId: string): { type: string; bookingId: string | null } {
  const [type, rawEntityId] = itemId.split(':', 2);
  if (!type || !rawEntityId) return { type: '', bookingId: null };
  if (type === 'coverage_gap' || type === 'unassigned') {
    return { type, bookingId: rawEntityId };
  }
  if (type === 'overlap') {
    const [bookingAId] = rawEntityId.split('_', 1);
    return { type, bookingId: bookingAId || null };
  }
  return { type, bookingId: null };
}

function isAllowedType(type: string): boolean {
  return type === 'coverage_gap' || type === 'unassigned' || type === 'overlap';
}

const ROLLBACK_TOKEN_SECRET =
  process.env.ROLLBACK_TOKEN_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'dev-rollback-token-secret-change-me';

function tokenSignature(tokenId: string, assignmentId: string, bookingId: string, actorUserId: string): string {
  return createHmac('sha256', ROLLBACK_TOKEN_SECRET)
    .update(`${tokenId}:${assignmentId}:${bookingId}:${actorUserId}`)
    .digest('base64url');
}

function encodeRollbackToken(tokenId: string, assignmentId: string, bookingId: string, actorUserId: string): string {
  const sig = tokenSignature(tokenId, assignmentId, bookingId, actorUserId);
  return Buffer.from(`${tokenId}:${assignmentId}:${sig}`).toString('base64url');
}

function decodeRollbackToken(token: string): { tokenId: string; assignmentId: string; sig: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [tokenId, ...rest] = decoded.split(':');
    if (!tokenId || rest.length < 2) return null;
    const sig = rest[rest.length - 1];
    const assignmentId = rest.slice(0, rest.length - 1).join(':');
    if (!assignmentId || !sig) return null;
    return { tokenId, assignmentId, sig };
  } catch {
    return null;
  }
}

function verifyRollbackTokenSignature(
  tokenId: string,
  assignmentId: string,
  bookingId: string,
  actorUserId: string,
  providedSig: string
): boolean {
  const expected = tokenSignature(tokenId, assignmentId, bookingId, actorUserId);
  const a = Buffer.from(expected);
  const b = Buffer.from(providedSig);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function renderNotifyTemplate(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k: string) => vars[k] ?? '');
}

async function hasConfirmedOverlap(
  db: ReturnType<typeof getScopedDb>,
  bookingId: string,
  sitterId: string,
  startAt: Date,
  endAt: Date
): Promise<boolean> {
  const conflict = await db.booking.findFirst({
    where: {
      id: { not: bookingId },
      sitterId,
      status: { in: ['confirmed', 'in_progress'] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true },
  });
  return !!conflict;
}

async function getAvailableSoonest(
  db: ReturnType<typeof getScopedDb>,
  sitterId: string,
  bookingStartAt: Date
): Promise<string> {
  const nextBooking = await db.booking.findFirst({
    where: {
      sitterId,
      status: { in: ['confirmed', 'in_progress'] },
      startAt: { gte: bookingStartAt },
    },
    orderBy: { startAt: 'asc' },
    select: { startAt: true },
  });
  return (nextBooking?.startAt ?? new Date(0)).toISOString();
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

  const ip = getRateLimitIdentifier(request);
  const actorUserId = ctx.userId ?? 'system';
  let db: ReturnType<typeof getScopedDb> | null = null;
  let requestBookingId: string | null = null;
  let requestAction: ResolveAction | undefined;
  let requestSitterId: string | undefined;

  try {
    db = getScopedDb(ctx);
    const rate = await checkRateLimit(`${ctx.orgId}:${ip}:${actorUserId}`, {
      keyPrefix: 'ops-staffing-resolve',
      limit: 2,
      windowSec: 60,
    });
    if (!rate.success) return rateLimitResponse(rate.retryAfter);

    const body = (await request.json()) as {
      itemId?: string;
      action?: ResolveAction;
      sitterId?: string;
      rollbackToken?: string;
    };
    const itemId = (body.itemId || '').trim();
    const action = body.action;
    const { type, bookingId } = parseItemId(itemId);
    requestBookingId = bookingId;
    requestAction = action;
    requestSitterId = body.sitterId;
    if (!itemId || !action || !bookingId || !isAllowedType(type)) {
      return NextResponse.json({ error: 'itemId and action are required' }, { status: 400 });
    }

    const booking = await db.booking.findFirst({
      where: { id: bookingId },
      select: {
        id: true,
        orgId: true,
        firstName: true,
        lastName: true,
        service: true,
        sitterId: true,
        status: true,
        dispatchStatus: true,
        startAt: true,
        endAt: true,
      },
    });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const assignmentId = `staffing_assign:${booking.id}`;
    const rollbackTokenIdPrefix = `rbk_${booking.id}_`;

    await db.eventLog.create({
      data: {
        orgId: ctx.orgId,
        eventType: action === 'rollback' ? 'staffing.rollback.requested' : 'staffing.assign.requested',
        status: 'pending',
        bookingId: booking.id,
        metadata: JSON.stringify({
          bookingId: booking.id,
          sitterId: body.sitterId ?? null,
          rollbackTokenId: body.rollbackToken ? 'provided' : null,
          actorUserId,
          itemId,
          assignmentId,
          correlationId: ctx.correlationId,
        }),
      },
    });

    if (action === 'rollback') {
      if (!body.rollbackToken) {
        return NextResponse.json({ error: 'rollbackToken is required' }, { status: 400 });
      }
      const tokenDecoded = decodeRollbackToken(body.rollbackToken);
      if (!tokenDecoded || tokenDecoded.assignmentId !== assignmentId) {
        return NextResponse.json({ error: 'Invalid rollback token' }, { status: 400 });
      }
      if (
        !verifyRollbackTokenSignature(
          tokenDecoded.tokenId,
          tokenDecoded.assignmentId,
          booking.id,
          actorUserId,
          tokenDecoded.sig
        )
      ) {
        await db.eventLog.create({
          data: {
            orgId: ctx.orgId,
            eventType: 'staffing.rollback.failed',
            status: 'failed',
            bookingId: booking.id,
            error: 'Invalid rollback token signature',
            metadata: JSON.stringify({
              bookingId: booking.id,
              rollbackTokenId: tokenDecoded.tokenId,
              actorUserId,
              assignmentId,
              correlationId: ctx.correlationId,
            }),
          },
        });
        return NextResponse.json({ error: 'Invalid rollback token' }, { status: 400 });
      }

      const tokenUsed = await db.eventLog.findFirst({
        where: {
          eventType: 'ops.staffing.rollback_used',
          metadata: { contains: `"tokenId":"${tokenDecoded.tokenId}"` },
        },
        select: { id: true },
      });
      if (tokenUsed) {
        return NextResponse.json({ error: 'Rollback token already used' }, { status: 409 });
      }

      const tokenIssued = await db.eventLog.findFirst({
        where: {
          eventType: 'ops.staffing.rollback_issued',
          metadata: { contains: `"tokenId":"${tokenDecoded.tokenId}"` },
        },
        orderBy: { createdAt: 'desc' },
        select: { metadata: true },
      });
      if (!tokenIssued?.metadata) {
        return NextResponse.json({ error: 'Rollback token not found' }, { status: 404 });
      }

      const parsed = JSON.parse(tokenIssued.metadata) as {
        tokenId: string;
        actorUserId: string;
        bookingId: string;
        previousSitterId: string | null;
        previousStatus: string;
        previousDispatchStatus: string | null;
        previousAttentionState: SnapshotAttentionState;
      };
      if (parsed.bookingId !== booking.id || parsed.actorUserId !== actorUserId) {
        await db.eventLog.create({
          data: {
            orgId: ctx.orgId,
            eventType: 'staffing.rollback.failed',
            status: 'failed',
            bookingId: booking.id,
            error: 'Rollback token scope mismatch',
            metadata: JSON.stringify({
              bookingId: booking.id,
              rollbackTokenId: tokenDecoded.tokenId,
              actorUserId,
              assignmentId,
              correlationId: ctx.correlationId,
            }),
          },
        });
        return NextResponse.json({ error: 'Rollback token scope mismatch' }, { status: 409 });
      }

      await db.booking.update({
        where: { id: booking.id },
        data: {
          sitterId: parsed.previousSitterId,
          dispatchStatus: parsed.previousDispatchStatus ?? 'auto',
          status: parsed.previousStatus || 'pending',
        },
      });

      // Calendar consistency: remove event from sitter we rolled back from, sync for restored sitter
      if (booking.sitterId) {
        enqueueCalendarSync({
          type: 'delete',
          bookingId: booking.id,
          sitterId: booking.sitterId,
          orgId: ctx.orgId,
          correlationId: ctx.correlationId,
        }).catch((e) => console.error('[Staffing Rollback] calendar delete enqueue failed:', e));
      }
      if (parsed.previousSitterId) {
        enqueueCalendarSync({
          type: 'upsert',
          bookingId: booking.id,
          orgId: ctx.orgId,
          correlationId: ctx.correlationId,
        }).catch((e) => console.error('[Staffing Rollback] calendar upsert enqueue failed:', e));
      }

      if (!parsed.previousAttentionState) {
        await db.commandCenterAttentionState.deleteMany({
          where: { itemKey: itemId },
        });
      } else {
        await db.commandCenterAttentionState.upsert({
          where: { orgId_itemKey: { orgId: ctx.orgId, itemKey: itemId } },
          create: {
            orgId: ctx.orgId,
            itemKey: itemId,
            handledAt: parsed.previousAttentionState.handledAt
              ? new Date(parsed.previousAttentionState.handledAt)
              : null,
            snoozedUntil: parsed.previousAttentionState.snoozedUntil
              ? new Date(parsed.previousAttentionState.snoozedUntil)
              : null,
          },
          update: {
            handledAt: parsed.previousAttentionState.handledAt
              ? new Date(parsed.previousAttentionState.handledAt)
              : null,
            snoozedUntil: parsed.previousAttentionState.snoozedUntil
              ? new Date(parsed.previousAttentionState.snoozedUntil)
              : null,
          },
        });
      }

      await db.eventLog.create({
        data: {
          orgId: ctx.orgId,
          eventType: 'ops.staffing.rollback_used',
          status: 'success',
          bookingId: booking.id,
          metadata: JSON.stringify({
            tokenId: tokenDecoded.tokenId,
            assignmentId,
            itemId,
            correlationId: ctx.correlationId,
          }),
        },
      });

      await logEvent({
        orgId: ctx.orgId,
        actorUserId,
        action: 'ops.staffing.rollback',
        status: 'success',
        bookingId: booking.id,
        metadata: {
          itemId,
          type,
          assignmentId,
          rollbackTokenUsed: true,
          rollbackTokenId: tokenDecoded.tokenId,
          restoredSitterId: parsed.previousSitterId,
          ip,
        },
      });

      await db.eventLog.create({
        data: {
          orgId: ctx.orgId,
          eventType: 'staffing.rollback.succeeded',
          status: 'success',
          bookingId: booking.id,
          metadata: JSON.stringify({
            bookingId: booking.id,
            sitterId: parsed.previousSitterId,
            rollbackTokenId: tokenDecoded.tokenId,
            actorUserId,
            assignmentId,
            correlationId: ctx.correlationId,
          }),
        },
      });

      return NextResponse.json({
        ok: true,
        assignmentId,
        bookingId: booking.id,
        sitterId: parsed.previousSitterId,
      });
    }

    const existingAssignment = await db.eventLog.findFirst({
      where: {
        eventType: 'ops.staffing.assign_notify',
        status: 'success',
        bookingId: booking.id,
        metadata: { contains: `"assignmentId":"${assignmentId}"` },
      },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });
    if (existingAssignment?.metadata && booking.sitterId) {
      const existing = JSON.parse(existingAssignment.metadata) as {
        sitterId?: string;
        notifySent?: boolean;
        rollbackTokenId?: string;
      };
      const rollbackToken =
        typeof existing.rollbackTokenId === 'string'
          ? encodeRollbackToken(existing.rollbackTokenId, assignmentId, booking.id, actorUserId)
          : null;
      return NextResponse.json({
        assignmentId,
        bookingId: booking.id,
        sitterId: booking.sitterId,
        rollbackToken,
        rollbackTokenId: existing.rollbackTokenId ?? null,
        notifySent: existing.notifySent === true,
        idempotent: true,
      });
    }

    let selectedSitterId = body.sitterId ?? null;
    if (!selectedSitterId) {
      const sitters = await db.sitter.findMany({
        where: { active: true, deletedAt: null },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 50,
      });
      const ranked: Array<{ id: string; availableSoonest: string }> = [];

      for (const sitter of sitters) {
        const hasOverlap = await hasConfirmedOverlap(
          db,
          booking.id,
          sitter.id,
          booking.startAt,
          booking.endAt
        );
        if (hasOverlap) continue;
        ranked.push({
          id: sitter.id,
          availableSoonest: await getAvailableSoonest(db, sitter.id, booking.startAt),
        });
      }
      ranked.sort((a, b) =>
        a.availableSoonest === b.availableSoonest
          ? a.id.localeCompare(b.id)
          : a.availableSoonest.localeCompare(b.availableSoonest)
      );
      selectedSitterId = ranked[0]?.id ?? null;
    }

    if (!selectedSitterId) {
      return NextResponse.json(
        { error: 'No available sitter found for one-click assignment' },
        { status: 409 }
      );
    }

    const selectedHasOverlap = await hasConfirmedOverlap(
      db,
      booking.id,
      selectedSitterId,
      booking.startAt,
      booking.endAt
    );
    if (selectedHasOverlap) {
      return NextResponse.json(
        { error: 'Selected sitter has overlapping confirmed booking' },
        { status: 409 }
      );
    }
    const previousSitterId = booking.sitterId;
    const previousAttentionStateRecord = await db.commandCenterAttentionState.findFirst({
      where: { itemKey: itemId },
      select: { handledAt: true, snoozedUntil: true },
    });
    const previousAttentionState: SnapshotAttentionState = previousAttentionStateRecord
      ? {
          handledAt: previousAttentionStateRecord.handledAt?.toISOString() ?? null,
          snoozedUntil: previousAttentionStateRecord.snoozedUntil?.toISOString() ?? null,
        }
      : null;

    await forceAssignSitter(
      ctx.orgId,
      booking.id,
      selectedSitterId,
      'Command Center one-click assign',
      actorUserId ?? 'system',
      { force: true, correlationId: ctx.correlationId }
    );

    const rollbackTokenId = `${rollbackTokenIdPrefix}${randomUUID()}`;
    const rollbackToken = encodeRollbackToken(rollbackTokenId, assignmentId, booking.id, actorUserId);

    await db.eventLog.create({
      data: {
        orgId: ctx.orgId,
        eventType: 'ops.staffing.rollback_issued',
        status: 'success',
        bookingId: booking.id,
        metadata: JSON.stringify({
          tokenId: rollbackTokenId,
          assignmentId,
          bookingId: booking.id,
          actorUserId,
          itemId,
          previousSitterId,
          previousStatus: booking.status,
          previousDispatchStatus: booking.dispatchStatus,
          previousAttentionState,
          correlationId: ctx.correlationId,
        }),
      },
    });

    let notifySent = false;
    let notifyTemplateApplied = false;
    try {
      await db.eventLog.create({
        data: {
          orgId: ctx.orgId,
          eventType: 'ops.staffing.notify.queued',
          status: 'pending',
          bookingId: booking.id,
          metadata: JSON.stringify({
            assignmentId,
            itemId,
            sitterId: selectedSitterId,
            actorUserId,
            rollbackTokenId,
            correlationId: ctx.correlationId,
          }),
        },
      });
      notifySent = true;

      const templateSetting = await db.setting.findFirst({
        where: { key: 'ops.staffing.assign_notify.template' },
        select: { value: true },
      });
      const template = templateSetting?.value?.trim() || '';
      const rendered = template
        ? renderNotifyTemplate(template, {
            firstName: booking.firstName,
            lastName: booking.lastName,
            service: booking.service,
            startAt: booking.startAt.toISOString(),
            bookingId: booking.id,
          })
        : `Assignment update: ${booking.service} booking ${booking.id} assigned.`;
      await db.eventLog.create({
        data: {
          orgId: ctx.orgId,
          eventType: 'message.sent',
          status: 'success',
          bookingId: booking.id,
          metadata: JSON.stringify({
            channel: 'staffing_assign_notify',
            assignmentId,
            sitterId: selectedSitterId,
            body: rendered,
            templateConfigured: !!template,
            correlationId: ctx.correlationId,
          }),
        },
      });
      notifyTemplateApplied = !!template;
    } catch {
      notifySent = false;
    }

    await db.eventLog.create({
      data: {
        orgId: ctx.orgId,
        eventType: 'ops.staffing.assign_notify',
        status: 'success',
        bookingId: booking.id,
        metadata: JSON.stringify({
          assignmentId,
          bookingId: booking.id,
          itemId,
          sitterId: selectedSitterId,
          rollbackTokenId,
          notifySent,
          notifyTemplateApplied,
          previousSitterId,
          correlationId: ctx.correlationId,
        }),
      },
    });

    await logEvent({
      orgId: ctx.orgId,
      actorUserId,
      action: 'ops.staffing.assign_notify',
      status: 'success',
      bookingId: booking.id,
      metadata: {
        itemId,
        type,
        assignmentId,
        selectedSitterId,
        previousSitterId,
        rollbackTokenId,
        notifySent,
        rollbackTokenIssued: true,
        ip,
      },
    });

    await db.eventLog.create({
      data: {
        orgId: ctx.orgId,
        eventType: 'staffing.assign.succeeded',
        status: 'success',
        bookingId: booking.id,
        metadata: JSON.stringify({
          bookingId: booking.id,
          sitterId: selectedSitterId,
          rollbackTokenId,
          actorUserId,
          assignmentId,
          notifySent,
          correlationId: ctx.correlationId,
        }),
      },
    });

    return NextResponse.json({
      assignmentId,
      bookingId: booking.id,
      sitterId: selectedSitterId,
      rollbackToken,
      rollbackTokenId,
      notifySent,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (requestBookingId && db) {
      await db.eventLog.create({
        data: {
          orgId: ctx.orgId,
          eventType:
            requestAction === 'rollback' ? 'staffing.rollback.failed' : 'staffing.assign.failed',
          status: 'failed',
          bookingId: requestBookingId,
          error: message,
          metadata: JSON.stringify({
            bookingId: requestBookingId,
            sitterId: requestSitterId ?? null,
            rollbackTokenId: null,
            actorUserId,
            correlationId: ctx.correlationId,
          }),
        },
      });
    }
    await logEvent({
      orgId: ctx.orgId,
      actorUserId,
      action: 'ops.staffing.assign_notify',
      status: 'failed',
      metadata: { message, ip },
    });
    return NextResponse.json({ error: 'Failed to resolve staffing item', message }, { status: 500 });
  }
}
