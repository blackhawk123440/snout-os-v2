import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';

async function getOwnerCtx() {
  const ctx = await getRequestContext();
  requireAnyRole(ctx, ['owner', 'admin']);
  return ctx;
}

export async function GET() {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const list = await db.serviceConfig.findMany({
      where: {},
      orderBy: { serviceName: 'asc' },
    });
    return NextResponse.json({
      configs: list.map((r) => ({
        id: r.id,
        orgId: r.orgId,
        serviceName: r.serviceName,
        basePrice: r.basePrice,
        defaultDuration: r.defaultDuration,
        category: r.category,
        minBookingNotice: r.minBookingNotice,
        gpsCheckInRequired: r.gpsCheckInRequired,
        photosRequired: r.photosRequired,
        allowedSitterTiers: r.allowedSitterTiers,
        allowedSitterTypes: r.allowedSitterTypes,
        weekendMultiplier: r.weekendMultiplier,
        holidayMultiplier: r.holidayMultiplier,
        timeOfDayRules: r.timeOfDayRules,
        holidayBehavior: r.holidayBehavior,
        enabled: r.enabled,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw e;
  }
}

function parseServiceBody(body: Record<string, unknown>) {
  const serviceName = String(body?.serviceName ?? '').trim();
  if (!serviceName) throw new Error('serviceName is required');
  return {
    serviceName,
    basePrice: body?.basePrice != null ? Number(body.basePrice) : null,
    defaultDuration: body?.defaultDuration != null ? Number(body.defaultDuration) : null,
    category: body?.category != null ? String(body.category) : null,
    minBookingNotice: body?.minBookingNotice != null ? Number(body.minBookingNotice) : null,
    gpsCheckInRequired: body?.gpsCheckInRequired === true,
    photosRequired: body?.photosRequired === true,
    allowedSitterTiers: body?.allowedSitterTiers != null ? (typeof body.allowedSitterTiers === 'string' ? body.allowedSitterTiers : JSON.stringify(body.allowedSitterTiers)) : null,
    allowedSitterTypes: body?.allowedSitterTypes != null ? (typeof body.allowedSitterTypes === 'string' ? body.allowedSitterTypes : JSON.stringify(body.allowedSitterTypes)) : null,
    weekendMultiplier: body?.weekendMultiplier != null ? Number(body.weekendMultiplier) : null,
    holidayMultiplier: body?.holidayMultiplier != null ? Number(body.holidayMultiplier) : null,
    timeOfDayRules: body?.timeOfDayRules != null ? (typeof body.timeOfDayRules === 'string' ? body.timeOfDayRules : JSON.stringify(body.timeOfDayRules)) : null,
    holidayBehavior: body?.holidayBehavior != null ? (typeof body.holidayBehavior === 'string' ? body.holidayBehavior : JSON.stringify(body.holidayBehavior)) : null,
    enabled: body?.enabled !== false,
  };
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const body = await request.json().catch(() => ({}));
    const data = parseServiceBody(body);
    const created = await db.serviceConfig.create({
      data: {
        ...data,
      },
    });
    return NextResponse.json(created);
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (e instanceof Error && e.message === 'serviceName is required') {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
