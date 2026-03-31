import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';

/**
 * GET /api/sitter/availability
 * Returns availability toggle + block-off days + rules + overrides for current sitter.
 * Query: ?preview=7 to include computed availability windows for next 7 days.
 */
export async function GET(request: NextRequest) {
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
    return NextResponse.json({ error: 'Sitter profile missing on session' }, { status: 403 });
  }

  try {
    const db = getScopedDb(ctx);
    const sitter = await db.sitter.findUnique({
      where: { id: ctx.sitterId },
      select: { availabilityEnabled: true },
    });
    if (!sitter) {
      return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });
    }

    const now = new Date();
    const [blockOffs, rules, overrides] = await Promise.all([
      db.sitterTimeOff.findMany({
        where: {
          sitterId: ctx.sitterId,
          type: 'block',
          endsAt: { gte: now },
        },
        orderBy: { startsAt: 'asc' },
        take: 30,
      }),
      (db as any).sitterAvailabilityRule.findMany({
        where: { sitterId: ctx.sitterId, active: true },
        orderBy: { createdAt: 'asc' },
      }),
      (db as any).sitterAvailabilityOverride.findMany({
        where: {
          sitterId: ctx.sitterId,
          date: { gte: now },
        },
        orderBy: { date: 'asc' },
        take: 60,
      }),
    ]);

    const result: Record<string, unknown> = {
      availabilityEnabled: (sitter as any).availabilityEnabled ?? true,
      blockOffDays: blockOffs.map((b) => ({
        id: b.id,
        date: b.startsAt.toISOString().slice(0, 10),
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
      })),
      rules: (rules || []).map((r: any) => ({
        id: r.id,
        daysOfWeek: r.daysOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        timezone: r.timezone,
      })),
      overrides: (overrides || []).map((o: any) => ({
        id: o.id,
        date: o.date instanceof Date ? o.date.toISOString().slice(0, 10) : String(o.date).slice(0, 10),
        startTime: o.startTime,
        endTime: o.endTime,
        isAvailable: o.isAvailable,
      })),
    };

    const previewDays = request.nextUrl?.searchParams?.get('preview');
    if (previewDays && parseInt(previewDays, 10) > 0) {
      const { getAvailabilityWindows } = await import('@/lib/availability/engine');
      const days = Math.min(parseInt(previewDays, 10), 14);
      const end = new Date(now);
      end.setDate(end.getDate() + days);
      const windows = await getAvailabilityWindows({
        db: db as any,
        orgId: ctx.orgId,
        sitterId: ctx.sitterId,
        start: now,
        end,
        respectGoogleBusy: true,
      });
      result.preview = windows.map((w) => ({
        start: w.start.toISOString(),
        end: w.end.toISOString(),
      }));
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load availability', message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sitter/availability
 * Body: { availabilityEnabled?: boolean }
 */
export async function PATCH(request: NextRequest) {
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

  let body: { availabilityEnabled?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.availabilityEnabled !== 'boolean') {
    return NextResponse.json({ error: 'availabilityEnabled must be boolean' }, { status: 400 });
  }

  try {
    const db = getScopedDb(ctx);
    const sitter = await db.sitter.findFirst({
      where: { id: ctx.sitterId },
    });
    if (!sitter) {
      return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });
    }
    await (db.sitter as any).update({
      where: { id: sitter.id },
      data: { availabilityEnabled: body.availabilityEnabled },
    });
    return NextResponse.json({ availabilityEnabled: body.availabilityEnabled });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update availability', message },
      { status: 500 }
    );
  }
}
