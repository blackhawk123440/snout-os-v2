/**
 * GET/PUT /api/sitter/quiet-hours
 * Sitter manages their notification quiet hours.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'sitter' || !ctx.sitterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const record = await (prisma as any).sitterQuietHours.findUnique({
      where: { sitterId: ctx.sitterId },
    });
    return NextResponse.json({
      data: record
        ? { startTime: record.startTime, endTime: record.endTime, enabled: record.enabled }
        : { startTime: '22:00', endTime: '07:00', enabled: false },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to load quiet hours' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'sitter' || !ctx.sitterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { startTime, endTime, enabled } = body;

    if (!startTime || !endTime) {
      return NextResponse.json({ error: 'startTime and endTime are required' }, { status: 400 });
    }

    // Validate time format HH:MM
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json({ error: 'Time must be in HH:MM format' }, { status: 400 });
    }

    const record = await (prisma as any).sitterQuietHours.upsert({
      where: { sitterId: ctx.sitterId },
      create: {
        orgId: ctx.orgId,
        sitterId: ctx.sitterId,
        startTime,
        endTime,
        enabled: enabled ?? true,
      },
      update: {
        startTime,
        endTime,
        enabled: enabled ?? true,
      },
    });

    return NextResponse.json({
      data: { startTime: record.startTime, endTime: record.endTime, enabled: record.enabled },
    });
  } catch (error: any) {
    console.error('[quiet-hours] Error:', error);
    return NextResponse.json({ error: 'Failed to save quiet hours' }, { status: 500 });
  }
}
