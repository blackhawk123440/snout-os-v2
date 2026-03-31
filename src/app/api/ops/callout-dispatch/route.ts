/**
 * Callout Auto-Dispatch API
 *
 * GET  — Returns affected bookings + replacement suggestions for manual_required bookings
 *        from a sitter callout. Query params: ?sitterId=X&date=YYYY-MM-DD
 *
 * POST — One-click dispatch: accepts replacement assignments, reassigns bookings,
 *        notifies replacement sitters and affected clients.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { rankSittersForBooking } from '@/lib/matching/sitter-matcher';
import { canSitterTakeBooking } from '@/lib/tier-permissions';
import { checkAssignmentAllowed } from '@/lib/availability/booking-conflict';
import { logEvent } from '@/lib/log-event';

// ─── GET: Fetch affected bookings + replacement suggestions ──────────

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sitterId = searchParams.get('sitterId');
    const date = searchParams.get('date');

    const db = getScopedDb(ctx);

    // Build query for affected bookings
    const where: any = {
      dispatchStatus: 'manual_required',
      status: { in: ['pending', 'confirmed'] },
    };

    if (sitterId) where.sitterId = sitterId;
    if (date) {
      const dayStart = new Date(date + 'T00:00:00');
      const dayEnd = new Date(date + 'T23:59:59.999');
      where.startAt = { gte: dayStart, lte: dayEnd };
    }

    const affected = await db.booking.findMany({
      where,
      select: {
        id: true,
        service: true,
        firstName: true,
        lastName: true,
        startAt: true,
        endAt: true,
        totalPrice: true,
        clientId: true,
        sitterId: true,
        address: true,
        recurringScheduleId: true,
      },
      orderBy: { startAt: 'asc' },
    });

    // Generate replacement suggestions for each booking
    const bookingsWithSuggestions = await Promise.all(
      affected.map(async (booking: any) => {
        // Urgency: hours until visit
        const hoursUntil = Math.max(
          0,
          (new Date(booking.startAt).getTime() - Date.now()) / (1000 * 60 * 60)
        );
        const urgency = hoursUntil < 2 ? 'critical' : hoursUntil < 6 ? 'high' : hoursUntil < 24 ? 'medium' : 'low';

        // Get ranked replacements
        let suggestions: Array<{
          sitterId: string;
          sitterName: string;
          score: number;
          tierEligible: boolean;
          tierReasons: string[];
          conflictFree: boolean;
        }> = [];

        try {
          const matches = await rankSittersForBooking({
            orgId: ctx.orgId,
            service: booking.service,
            startAt: booking.startAt,
            endAt: booking.endAt,
            clientId: booking.clientId || '',
          });

          // Filter out the called-out sitter and check tier + availability
          const filtered = matches.filter((m) => m.sitterId !== booking.sitterId);

          suggestions = await Promise.all(
            filtered.slice(0, 5).map(async (match) => {
              const tierCheck = await canSitterTakeBooking(match.sitterId, {
                service: booking.service,
                startAt: booking.startAt,
                totalPrice: booking.totalPrice ?? 0,
                clientId: booking.clientId,
                isRecurring: !!booking.recurringScheduleId,
              });

              const conflictCheck = await checkAssignmentAllowed({
                db,
                orgId: ctx.orgId,
                sitterId: match.sitterId,
                start: booking.startAt,
                end: booking.endAt,
              });

              return {
                sitterId: match.sitterId,
                sitterName: match.sitterName,
                score: match.score,
                tierEligible: tierCheck.allowed,
                tierReasons: tierCheck.reasons,
                conflictFree: conflictCheck.allowed,
              };
            })
          );
        } catch {
          // Non-fatal — return booking without suggestions
        }

        // Sort: conflict-free + tier-eligible first, then by score
        suggestions.sort((a, b) => {
          const aReady = a.conflictFree && a.tierEligible ? 1 : 0;
          const bReady = b.conflictFree && b.tierEligible ? 1 : 0;
          if (aReady !== bReady) return bReady - aReady;
          return b.score - a.score;
        });

        return {
          bookingId: booking.id,
          service: booking.service,
          clientName: `${booking.firstName} ${booking.lastName}`.trim(),
          clientId: booking.clientId,
          startAt: booking.startAt,
          endAt: booking.endAt,
          currentSitterId: booking.sitterId,
          urgency,
          hoursUntil: Math.round(hoursUntil * 10) / 10,
          topSuggestion: suggestions.find((s) => s.conflictFree && s.tierEligible) ?? null,
          allSuggestions: suggestions,
        };
      })
    );

    // Sort by urgency
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    bookingsWithSuggestions.sort(
      (a, b) => (urgencyOrder[a.urgency as keyof typeof urgencyOrder] ?? 4) - (urgencyOrder[b.urgency as keyof typeof urgencyOrder] ?? 4)
    );

    const noReplacementBookings = bookingsWithSuggestions.filter((b) => !b.topSuggestion);

    return NextResponse.json({
      affectedCount: bookingsWithSuggestions.length,
      bookings: bookingsWithSuggestions,
      readyForOneClick: bookingsWithSuggestions.filter((b) => b.topSuggestion).length,
      noReplacementCount: noReplacementBookings.length,
      // Escalation: bookings that need manual intervention
      needsEscalation: noReplacementBookings.map((b) => ({
        bookingId: b.bookingId,
        service: b.service,
        clientName: b.clientName,
        startAt: b.startAt,
        urgency: b.urgency,
        reason: b.allSuggestions.length === 0
          ? 'No active sitters available'
          : 'All available sitters have conflicts or tier restrictions',
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}

// ─── POST: One-click dispatch replacements ───────────────────────────

const DispatchSchema = z.object({
  assignments: z.array(z.object({
    bookingId: z.string().min(1),
    replacementSitterId: z.string().min(1),
  })).min(1).max(50),
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
    const parsed = DispatchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const db = getScopedDb(ctx);
    const results: Array<{
      bookingId: string;
      success: boolean;
      error?: string;
      replacementSitterName?: string;
    }> = [];

    for (const { bookingId, replacementSitterId } of parsed.data.assignments) {
      try {
        const booking = await db.booking.findFirst({
          where: { id: bookingId },
          select: {
            id: true, status: true, service: true, startAt: true, endAt: true,
            firstName: true, lastName: true, clientId: true, sitterId: true,
          },
        });
        if (!booking) { results.push({ bookingId, success: false, error: 'Not found' }); continue; }

        const replacement = await db.sitter.findFirst({
          where: { id: replacementSitterId, active: true, deletedAt: null },
          select: { id: true, firstName: true, lastName: true },
        });
        if (!replacement) { results.push({ bookingId, success: false, error: 'Replacement sitter not found' }); continue; }

        const replacementName = `${replacement.firstName} ${replacement.lastName}`.trim();

        // Re-validate at dispatch time (world may have changed since GET)
        const tierCheck = await canSitterTakeBooking(replacementSitterId, {
          service: booking.service,
          startAt: booking.startAt,
          totalPrice: 0,
          clientId: booking.clientId,
        });
        if (!tierCheck.allowed) {
          results.push({
            bookingId,
            success: false,
            error: `Tier restriction: ${tierCheck.reasons[0]}`,
          });
          continue;
        }

        const conflictCheck = await checkAssignmentAllowed({
          db,
          orgId: ctx.orgId,
          sitterId: replacementSitterId,
          start: booking.startAt,
          end: booking.endAt,
          bookingId,
        });
        if (!conflictCheck.allowed) {
          results.push({
            bookingId,
            success: false,
            error: `Conflict: ${conflictCheck.conflicts[0]?.detail ?? conflictCheck.conflicts[0]?.reason}`,
          });
          continue;
        }

        // Reassign booking
        await db.booking.update({
          where: { id: bookingId },
          data: {
            sitterId: replacementSitterId,
            dispatchStatus: 'assigned',
            status: booking.status === 'pending' ? 'confirmed' : booking.status,
          },
        });

        // Status history
        await db.bookingStatusHistory.create({
          data: {
            orgId: ctx.orgId,
            bookingId,
            fromStatus: booking.status,
            toStatus: booking.status === 'pending' ? 'confirmed' : booking.status,
            changedBy: ctx.userId ?? null,
            reason: 'callout_replacement',
          },
        });

        // Notify replacement sitter (fire and forget)
        void import('@/lib/notifications/triggers').then(({ notifySitterAssigned }) => {
          notifySitterAssigned({
            orgId: ctx.orgId,
            bookingId,
            sitterId: replacementSitterId,
            sitterFirstName: replacement.firstName,
            clientName: `${booking.firstName} ${booking.lastName}`.trim(),
            service: booking.service,
            startAt: booking.startAt,
          });
        }).catch(() => {});

        // Notify client of sitter change (fire and forget)
        if (booking.clientId) {
          void import('@/lib/notifications/triggers').then(async ({ notifyClientSitterChanged }) => {
            const pets = await db.pet.findMany({ where: { bookingId }, select: { name: true } });
            notifyClientSitterChanged({
              orgId: ctx.orgId,
              bookingId,
              clientId: booking.clientId!,
              newSitterName: replacementName,
              service: booking.service,
              startAt: booking.startAt,
              petNames: pets.map((p: any) => p.name).filter(Boolean).join(', '),
            });
          }).catch(() => {});
        }

        results.push({ bookingId, success: true, replacementSitterName: replacementName });
      } catch {
        results.push({ bookingId, success: false, error: 'Failed' });
      }
    }

    // Log the dispatch event
    await logEvent({
      orgId: ctx.orgId,
      action: 'callout.auto_dispatch',
      status: 'success',
      metadata: {
        assignmentCount: parsed.data.assignments.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        dispatchedBy: ctx.userId,
      },
    });

    return NextResponse.json({
      results,
      succeeded: results.filter((r) => r.success).length,
      total: results.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}
