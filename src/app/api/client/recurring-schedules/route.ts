/**
 * GET /api/client/recurring-schedules — list client's recurring schedules
 * POST /api/client/recurring-schedules — create a new recurring booking request
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { generateRecurringBookings } from '@/lib/recurring/generate';
import { logEvent } from '@/lib/log-event';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    const schedules = await db.recurringSchedule.findMany({
      where: { orgId: ctx.orgId, clientId: ctx.clientId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, service: true, frequency: true, daysOfWeek: true,
        startTime: true, endTime: true, effectiveFrom: true, effectiveUntil: true,
        status: true, totalPrice: true, address: true, notes: true,
        lastGeneratedAt: true, createdAt: true,
      },
    });

    return NextResponse.json({
      schedules: schedules.map((s: any) => ({
        ...s,
        daysOfWeek: s.daysOfWeek ? JSON.parse(s.daysOfWeek) : [],
        effectiveFrom: s.effectiveFrom?.toISOString(),
        effectiveUntil: s.effectiveUntil?.toISOString(),
        lastGeneratedAt: s.lastGeneratedAt?.toISOString(),
        createdAt: s.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load schedules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      service, frequency, daysOfWeek, startTime, endTime,
      effectiveFrom, effectiveUntil, address, notes, totalPrice, petIds,
    } = body;

    if (!service || !frequency || !startTime || !endTime || !effectiveFrom) {
      return NextResponse.json({ error: 'Missing required fields: service, frequency, startTime, endTime, effectiveFrom' }, { status: 400 });
    }

    if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(frequency)) {
      return NextResponse.json({ error: 'Invalid frequency. Must be daily, weekly, biweekly, or monthly.' }, { status: 400 });
    }

    const db = getScopedDb(ctx);

    // Check for conflicts with existing active schedules
    const existingSchedules = await db.recurringSchedule.findMany({
      where: { orgId: ctx.orgId, clientId: ctx.clientId, status: { in: ['active', 'pending'] } },
      select: { id: true, service: true, frequency: true, daysOfWeek: true, startTime: true, endTime: true },
    });

    const conflicts: Array<{ scheduleId: string; service: string; overlap: string }> = [];
    for (const existing of existingSchedules) {
      const existingDays: number[] = existing.daysOfWeek ? JSON.parse(existing.daysOfWeek) : [];
      const newDays: number[] = daysOfWeek || [];

      // Check time overlap on same days
      if (frequency === existing.frequency || frequency === 'daily' || existing.frequency === 'daily') {
        const daysOverlap = frequency === 'daily' || existing.frequency === 'daily'
          ? true
          : newDays.some((d: number) => existingDays.includes(d));

        if (daysOverlap) {
          const timeOverlap = startTime < existing.endTime && endTime > existing.startTime;
          if (timeOverlap) {
            conflicts.push({
              scheduleId: existing.id,
              service: existing.service,
              overlap: `${existing.startTime}–${existing.endTime}`,
            });
          }
        }
      }
    }

    // Get client info for pricing
    const client = await db.client.findUnique({
      where: { id: ctx.clientId },
      select: { address: true },
    });

    const schedule = await db.recurringSchedule.create({
      data: {
        orgId: ctx.orgId,
        clientId: ctx.clientId,
        service,
        frequency,
        daysOfWeek: daysOfWeek ? JSON.stringify(daysOfWeek) : null,
        startTime,
        endTime,
        effectiveFrom: new Date(effectiveFrom),
        effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
        address: address || client?.address || null,
        notes: notes || null,
        totalPrice: totalPrice || 0,
        petIds: petIds ? JSON.stringify(petIds) : null,
        status: 'pending', // Client-created schedules require owner approval
      },
    });

    // Notify owner about the new recurring request
    try {
      const { notifyOwnerPersonalPhone } = await import('@/lib/automation-owner-notify');
      const clientName = `${(await db.client.findUnique({ where: { id: ctx.clientId }, select: { firstName: true, lastName: true } }))?.firstName || ''} ${(await db.client.findUnique({ where: { id: ctx.clientId }, select: { lastName: true } }))?.lastName || ''}`.trim() || 'A client';
      const daysLabel = daysOfWeek ? `on ${daysOfWeek.map((d: number) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}` : frequency;
      await notifyOwnerPersonalPhone({
        bookingId: schedule.id,
        message: `📅 New recurring request: ${clientName} wants ${service} ${daysLabel} at ${startTime}. Approve in your dashboard.`,
        automationType: 'recurring.pending_approval',
      });
    } catch {}

    await logEvent({
      orgId: ctx.orgId,
      action: 'recurring.client_requested',
      entityType: 'recurring_schedule',
      entityId: schedule.id,
      status: 'pending',
      metadata: { service, frequency, clientId: ctx.clientId },
    }).catch(() => {});

    return NextResponse.json({
      schedule: { id: schedule.id, status: 'pending' },
      message: 'Recurring schedule submitted for approval. You\'ll be notified when it\'s approved.',
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      conflictWarning: conflicts.length > 0
        ? `Note: This schedule may overlap with your existing ${conflicts.map(c => c.service).join(', ')} schedule(s).`
        : undefined,
    }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
