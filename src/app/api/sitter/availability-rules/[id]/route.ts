/**
 * PATCH /api/sitter/availability-rules/[id] - Update rule
 * DELETE /api/sitter/availability-rules/[id] - Delete rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
    if (!ctx.sitterId) {
      return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { daysOfWeek, startTime, endTime, timezone, active } = body;

    const data: Record<string, unknown> = {};
    if (daysOfWeek !== undefined) {
      const days = Array.isArray(daysOfWeek) ? daysOfWeek : JSON.parse(daysOfWeek || '[]');
      data.daysOfWeek = JSON.stringify(days);
    }
    if (startTime !== undefined) data.startTime = String(startTime);
    if (endTime !== undefined) data.endTime = String(endTime);
    if (timezone !== undefined) data.timezone = String(timezone);
    if (typeof active === 'boolean') data.active = active;

    const db = getScopedDb(ctx);
    const rule = await (db as any).sitterAvailabilityRule.updateMany({
      where: { id, sitterId: ctx.sitterId },
      data,
    });
    if (rule.count === 0) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }
    const updated = await (db as any).sitterAvailabilityRule.findFirst({
      where: { id, sitterId: ctx.sitterId },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
    if (!ctx.sitterId) {
      return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });
    }

    const { id } = await params;
    const db = getScopedDb(ctx);
    const result = await (db as any).sitterAvailabilityRule.deleteMany({
      where: { id, sitterId: ctx.sitterId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
