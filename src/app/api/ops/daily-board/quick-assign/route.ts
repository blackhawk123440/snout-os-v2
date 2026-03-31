/**
 * POST /api/ops/daily-board/quick-assign
 * Quick-assign a sitter to an unassigned booking from the daily board.
 * Enforces tier permissions and availability conflict detection.
 * Owner can override either with a reason.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { canSitterTakeBooking, logTierOverride } from '@/lib/tier-permissions';
import { checkAssignmentAllowed } from '@/lib/availability/booking-conflict';

const QuickAssignSchema = z.object({
  bookingId: z.string().min(1),
  sitterId: z.string().min(1),
  tierOverride: z.boolean().optional(),
  conflictOverride: z.boolean().optional(),
  overrideReason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = QuickAssignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { bookingId, sitterId, tierOverride, conflictOverride, overrideReason } = parsed.data;
    const db = getScopedDb(ctx);

    // Verify booking exists and load details
    const booking = await db.booking.findFirst({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        sitterId: true,
        service: true,
        startAt: true,
        endAt: true,
        totalPrice: true,
        clientId: true,
        recurringScheduleId: true,
      },
    });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Verify sitter exists and is active
    const sitter = await db.sitter.findFirst({
      where: { id: sitterId, active: true, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!sitter) {
      return NextResponse.json({ error: 'Sitter not found or inactive' }, { status: 404 });
    }

    const sitterName = `${sitter.firstName} ${sitter.lastName}`.trim();
    const requiresOverrideReason = (tierOverride || conflictOverride) &&
      (!overrideReason || overrideReason.trim().length < 3);

    // --- Tier permission check ---
    const tierCheck = await canSitterTakeBooking(sitterId, {
      service: booking.service,
      startAt: booking.startAt,
      totalPrice: booking.totalPrice ?? 0,
      clientId: booking.clientId,
      isRecurring: !!booking.recurringScheduleId,
    });

    if (!tierCheck.allowed && !tierOverride) {
      return NextResponse.json(
        {
          error: 'Sitter tier does not allow this assignment',
          tierBlocked: true,
          reasons: tierCheck.reasons,
          sitterName,
        },
        { status: 422 }
      );
    }

    // --- Availability conflict check ---
    const conflictCheck = await checkAssignmentAllowed({
      db,
      orgId: ctx.orgId,
      sitterId,
      start: booking.startAt,
      end: booking.endAt,
      force: !!conflictOverride,
      actorUserId: ctx.userId ?? undefined,
      bookingId,
    });

    if (!conflictCheck.allowed && !conflictOverride) {
      return NextResponse.json(
        {
          error: 'Sitter has scheduling conflicts',
          conflictBlocked: true,
          conflicts: conflictCheck.conflicts,
          sitterName,
        },
        { status: 409 }
      );
    }

    // --- Override reason required if overriding anything ---
    if ((!tierCheck.allowed || !conflictCheck.allowed) && requiresOverrideReason) {
      return NextResponse.json(
        { error: 'Override reason is required (min 3 characters)' },
        { status: 400 }
      );
    }

    // Log tier override if applicable
    if (!tierCheck.allowed && tierOverride) {
      await logTierOverride({
        sitterId,
        bookingId,
        overrideReason: (overrideReason ?? '').trim(),
        overriddenBy: ctx.userId ?? 'unknown',
        blockedReasons: tierCheck.reasons,
      });
    }

    // Assign sitter and confirm
    const updateData: Record<string, any> = {
      sitterId,
      status: booking.status === 'pending' ? 'confirmed' : booking.status,
    };

    // Set conflict override marker if applicable
    if (!conflictCheck.allowed && conflictOverride) {
      updateData.conflictOverrideAt = new Date();
      updateData.conflictOverrideBy = ctx.userId ?? 'unknown';
      updateData.conflictOverrideReason = (overrideReason ?? '').trim() || null;
    }

    const updated = await db.booking.update({
      where: { id: bookingId },
      data: updateData,
      select: { id: true, sitterId: true, status: true },
    });

    // SSE: notify owner dispatch board
    void import('@/lib/realtime/bus').then(({ publish: pub, channels: ch }) => {
      pub(ch.ownerDispatch(ctx.orgId), {
        type: 'booking.assigned',
        bookingId,
        sitterId,
        sitterName,
        ts: Date.now(),
      });
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      booking: updated,
      tierOverridden: !tierCheck.allowed && !!tierOverride,
      conflictOverridden: !conflictCheck.allowed && !!conflictOverride,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to assign sitter', message },
      { status: 500 }
    );
  }
}
