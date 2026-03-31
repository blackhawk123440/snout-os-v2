/**
 * POST /api/ops/calendar/repair
 * Enqueue repair sync for a sitter's calendar in a date range.
 * Owner/admin only, org-scoped.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { enqueueCalendarSync } from '@/lib/calendar-queue';
import { logEvent } from '@/lib/log-event';

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

  let body: { sitterId?: string; start?: string; end?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sitterId = body.sitterId?.trim();
  if (!sitterId) {
    return NextResponse.json({ error: 'sitterId is required' }, { status: 400 });
  }

  const db = getScopedDb(ctx);
  const sitter = await db.sitter.findUnique({
    where: { id: sitterId },
    select: { id: true, orgId: true },
  });
  if (!sitter) {
    return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });
  }

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 1);
  const defaultEnd = new Date(now);
  defaultEnd.setDate(defaultEnd.getDate() + 14);

  const start = body.start ? new Date(body.start) : defaultStart;
  const end = body.end ? new Date(body.end) : defaultEnd;

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid start or end date' }, { status: 400 });
  }

  try {
    const jobId = await enqueueCalendarSync({
      type: 'syncRange',
      sitterId,
      start: start.toISOString(),
      end: end.toISOString(),
      orgId: ctx.orgId,
      correlationId: ctx.correlationId,
    });

    await logEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId ?? 'system',
      action: 'calendar.repair.requested',
      entityType: 'calendar',
      entityId: sitterId,
      correlationId: ctx.correlationId,
      metadata: { sitterId, start: start.toISOString(), end: end.toISOString(), jobId },
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Repair sync enqueued. Check EventLog for results.',
      range: { start: start.toISOString(), end: end.toISOString() },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to enqueue repair', message }, { status: 500 });
  }
}
