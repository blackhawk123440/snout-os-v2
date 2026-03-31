/**
 * POST /api/sitter/running-late
 *
 * Sitter quick action: notify that they're running late for a booking.
 * Sends notifications to client and owner. Logs event.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole } from '@/lib/rbac';
import { logEvent } from '@/lib/log-event';
import { publish, channels } from '@/lib/realtime/bus';

const RunningLateSchema = z.object({
  bookingId: z.string().min(1),
  delayMinutes: z.number().int().min(5).max(120),
  message: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = RunningLateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { bookingId, delayMinutes, message } = parsed.data;
    const db = getScopedDb(ctx);

    // Verify booking belongs to this sitter
    const booking = await db.booking.findFirst({
      where: {
        id: bookingId,
        sitterId: ctx.sitterId,
        status: { in: ['pending', 'confirmed'] },
      },
      select: {
        id: true,
        service: true,
        startAt: true,
        firstName: true,
        lastName: true,
        clientId: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found or not eligible' }, { status: 404 });
    }

    // Get sitter name
    const sitter = await db.sitter.findUnique({
      where: { id: ctx.sitterId },
      select: { firstName: true, lastName: true },
    });
    const sitterName = sitter ? `${sitter.firstName} ${sitter.lastName}`.trim() : 'Your sitter';
    const clientName = `${booking.firstName} ${booking.lastName}`.trim();

    // Calculate new ETA
    const originalStart = new Date(booking.startAt);
    const newEta = new Date(originalStart.getTime() + delayMinutes * 60 * 1000);
    const etaStr = newEta.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    // Push notification to client (fire and forget)
    if (booking.clientId) {
      void import('@/lib/notifications/push-dispatch').then(({ pushNewMessage }) => {
        pushNewMessage({
          recipientClientId: booking.clientId!,
          senderName: sitterName,
          preview: `Running about ${delayMinutes} min late. New ETA: ${etaStr}`,
          threadUrl: `/client/bookings/${bookingId}`,
        });
      }).catch(() => {});
    }

    // Notify owner via realtime
    publish(channels.ownerOps(ctx.orgId), {
      type: 'sitter.running_late',
      sitterId: ctx.sitterId,
      sitterName,
      bookingId,
      clientName,
      service: booking.service,
      delayMinutes,
      newEta: newEta.toISOString(),
      message: message || null,
      ts: Date.now(),
    }).catch(() => {});

    // Log event
    await logEvent({
      orgId: ctx.orgId,
      action: 'sitter.running_late',
      bookingId,
      actorUserId: ctx.userId ?? undefined,
      status: 'success',
      metadata: {
        sitterId: ctx.sitterId,
        sitterName,
        delayMinutes,
        originalStartAt: booking.startAt,
        newEta: newEta.toISOString(),
        message: message || null,
      },
    });

    return NextResponse.json({
      success: true,
      newEta: newEta.toISOString(),
      etaDisplay: etaStr,
      delayMinutes,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}
