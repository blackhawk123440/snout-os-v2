/**
 * POST /api/sitter/availability-overrides - Create override
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';

export async function POST(request: NextRequest) {
  try {
    const ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
    if (!ctx.sitterId) {
      return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });
    }

    const body = await request.json();
    const { date, startTime, endTime, isAvailable } = body;

    if (!date || !startTime || !endTime || typeof isAvailable !== 'boolean') {
      return NextResponse.json(
        { error: 'date, startTime, endTime, isAvailable are required' },
        { status: 400 }
      );
    }

    const dateObj = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(date + 'T12:00:00')
      : new Date(date);
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const db = getScopedDb(ctx);
    const override = await (db as any).sitterAvailabilityOverride.create({
      data: {
        sitterId: ctx.sitterId,
        date: dateObj,
        startTime: String(startTime),
        endTime: String(endTime),
        isAvailable: Boolean(isAvailable),
      },
    });
    return NextResponse.json(override);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
