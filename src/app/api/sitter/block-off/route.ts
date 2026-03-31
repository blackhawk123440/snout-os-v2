import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';

/**
 * POST /api/sitter/block-off
 * Body: { date: "YYYY-MM-DD" }
 */
export async function POST(request: NextRequest) {
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

  if (!ctx.sitterId || !ctx.userId) {
    return NextResponse.json({ error: 'Sitter profile missing on session' }, { status: 403 });
  }

  let body: { date?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const dateStr = body.date;
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }

  const startsAt = new Date(dateStr + 'T00:00:00');
  const endsAt = new Date(dateStr + 'T23:59:59.999');
  if (startsAt.getTime() !== startsAt.getTime() || isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  try {
    const db = getScopedDb(ctx);
    const existing = await db.sitterTimeOff.findFirst({
      where: {
        sitterId: ctx.sitterId,
        type: 'block',
        startsAt: { lte: startsAt },
        endsAt: { gte: endsAt },
      },
    });
    if (existing) {
      return NextResponse.json({ error: 'Date already blocked' }, { status: 409 });
    }

    const block = await (db.sitterTimeOff as any).create({
      data: {
        sitterId: ctx.sitterId,
        type: 'block',
        startsAt,
        endsAt,
        approvedByUserId: ctx.userId,
      },
    });
    return NextResponse.json({
      id: block.id,
      date: dateStr,
      startsAt: block.startsAt.toISOString(),
      endsAt: block.endsAt.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to add block-off day', message },
      { status: 500 }
    );
  }
}
