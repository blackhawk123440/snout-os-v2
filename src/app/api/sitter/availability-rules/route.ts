/**
 * GET /api/sitter/availability-rules - List rules
 * POST /api/sitter/availability-rules - Create rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });
  }

  try {
    const db = getScopedDb(ctx);
    const rules = await (db as any).sitterAvailabilityRule.findMany({
      where: { sitterId: ctx.sitterId },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ rules });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load rules', message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
    if (!ctx.sitterId) {
      return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });
    }

    const body = await request.json();
    const { daysOfWeek, startTime, endTime, timezone } = body;

    if (!daysOfWeek || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'daysOfWeek, startTime, endTime are required' },
        { status: 400 }
      );
    }

    const days = Array.isArray(daysOfWeek) ? daysOfWeek : JSON.parse(daysOfWeek || '[]');
    if (!Array.isArray(days) || days.some((d: unknown) => typeof d !== 'number' || d < 0 || d > 6)) {
      return NextResponse.json(
        { error: 'daysOfWeek must be array of 0-6 (Sun-Sat)' },
        { status: 400 }
      );
    }

    const db = getScopedDb(ctx);
    const rule = await (db as any).sitterAvailabilityRule.create({
      data: {
        sitterId: ctx.sitterId,
        daysOfWeek: JSON.stringify(days),
        startTime: String(startTime),
        endTime: String(endTime),
        timezone: timezone || 'America/Chicago',
        active: true,
      },
    });
    return NextResponse.json(rule);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to create rule', message }, { status: 500 });
  }
}
