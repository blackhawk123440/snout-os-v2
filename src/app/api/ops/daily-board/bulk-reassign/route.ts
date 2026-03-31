/**
 * POST /api/ops/daily-board/bulk-reassign
 * Bulk assign sitters to multiple bookings. Reports per-item conflicts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { checkAssignmentAllowed } from '@/lib/availability/booking-conflict';

const BulkAssignSchema = z.object({
  assignments: z.array(z.object({
    bookingId: z.string().min(1),
    sitterId: z.string().min(1),
  })).min(1).max(50),
  forceConflicts: z.boolean().optional(),
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
    const parsed = BulkAssignSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const { assignments, forceConflicts } = parsed.data;
    const db = getScopedDb(ctx);
    const results: Array<{
      bookingId: string;
      success: boolean;
      error?: string;
      conflicts?: { reason: string; detail?: string }[];
    }> = [];

    for (const { bookingId, sitterId } of assignments) {
      try {
        const booking = await db.booking.findFirst({
          where: { id: bookingId },
          select: {
            id: true, status: true, firstName: true, lastName: true,
            service: true, startAt: true, endAt: true, clientId: true,
          },
        });
        if (!booking) { results.push({ bookingId, success: false, error: 'Not found' }); continue; }

        // Conflict check
        const conflictCheck = await checkAssignmentAllowed({
          db,
          orgId: ctx.orgId,
          sitterId,
          start: booking.startAt,
          end: booking.endAt,
          force: !!forceConflicts,
          actorUserId: ctx.userId ?? undefined,
          bookingId,
        });

        if (!conflictCheck.allowed) {
          results.push({
            bookingId,
            success: false,
            error: 'Scheduling conflict',
            conflicts: conflictCheck.conflicts,
          });
          continue;
        }

        await db.booking.update({
          where: { id: bookingId },
          data: {
            sitterId,
            status: booking.status === 'pending' ? 'confirmed' : booking.status,
          },
        });

        // Notify replacement sitter (fire and forget)
        void import('@/lib/notifications/triggers').then(async ({ notifySitterAssigned }) => {
          const sitter = await db.sitter.findUnique({ where: { id: sitterId }, select: { firstName: true, lastName: true } });
          notifySitterAssigned({
            orgId: ctx.orgId,
            bookingId,
            sitterId,
            sitterFirstName: sitter?.firstName || 'Sitter',
            clientName: `${booking.firstName || ''} ${booking.lastName || ''}`.trim(),
            service: booking.service,
            startAt: booking.startAt,
          });
        }).catch(() => {});

        // Notify client of sitter change (fire and forget)
        void import('@/lib/notifications/triggers').then(async ({ notifyClientSitterChanged }) => {
          if (!booking.clientId) return;
          const sitter = await db.sitter.findUnique({ where: { id: sitterId }, select: { firstName: true, lastName: true } });
          const pets = await db.pet.findMany({ where: { bookingId }, select: { name: true } });
          notifyClientSitterChanged({
            orgId: ctx.orgId,
            bookingId,
            clientId: booking.clientId,
            newSitterName: sitter ? `${sitter.firstName} ${sitter.lastName}`.trim() : 'your sitter',
            service: booking.service,
            startAt: booking.startAt,
            petNames: pets.map((p: any) => p.name).filter(Boolean).join(', '),
          });
        }).catch(() => {});

        results.push({ bookingId, success: true });
      } catch { results.push({ bookingId, success: false, error: 'Failed' }); }
    }

    const succeeded = results.filter((r) => r.success).length;
    const conflicted = results.filter((r) => !r.success && r.conflicts).length;
    return NextResponse.json({ results, succeeded, conflicted, total: results.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}
