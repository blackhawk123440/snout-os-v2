/**
 * POST /api/bookings/[id]/check-conflicts
 * Pre-flight conflict check for a specific booking + sitter combination.
 * Returns conflicts without performing the assignment.
 * Used by the UI to show warnings before the user confirms.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { validateSitterAssignment } from '@/lib/availability/booking-conflict';
import { canSitterTakeBooking, getSitterTierInfo } from '@/lib/tier-permissions';

const CheckSchema = z.object({
  sitterId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: bookingId } = await params;
    const body = await request.json();
    const parsed = CheckSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'sitterId is required' }, { status: 400 });
    }

    const { sitterId } = parsed.data;
    const db = getScopedDb(ctx);

    const booking = await db.booking.findFirst({
      where: { id: bookingId },
      select: {
        id: true,
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

    // Run both checks in parallel
    const [availabilityResult, tierResult, tierInfo] = await Promise.all([
      validateSitterAssignment({
        db,
        orgId: ctx.orgId,
        sitterId,
        start: booking.startAt,
        end: booking.endAt,
        excludeBookingId: bookingId,
        respectGoogleBusy: true,
      }),
      canSitterTakeBooking(sitterId, {
        service: booking.service,
        startAt: booking.startAt,
        totalPrice: booking.totalPrice ?? 0,
        clientId: booking.clientId,
        isRecurring: !!booking.recurringScheduleId,
      }),
      getSitterTierInfo(sitterId),
    ]);

    // Separate blocking conflicts from warnings
    const blockingConflicts = availabilityResult.conflicts.filter(
      (c) => c.reason === 'booking_conflict'
    );
    const warningConflicts = availabilityResult.conflicts.filter(
      (c) => c.reason !== 'booking_conflict'
    );

    return NextResponse.json({
      clear: availabilityResult.ok && tierResult.allowed,
      // Availability
      availabilityOk: availabilityResult.ok,
      blockingConflicts,
      warningConflicts,
      // Tier
      tierOk: tierResult.allowed,
      tierReasons: tierResult.reasons,
      tierName: tierInfo?.name ?? 'Unassigned',
      // Can override?
      canOverride: true, // Owner/admin can always override
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Conflict check failed', message }, { status: 500 });
  }
}
