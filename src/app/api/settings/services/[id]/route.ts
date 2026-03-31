import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';

async function getOwnerCtx() {
  const ctx = await getRequestContext();
  requireAnyRole(ctx, ['owner', 'admin']);
  return ctx;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const { id } = await params;
    const row = await db.serviceConfig.findFirst({ where: { id } });
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw e;
  }
}

function parseServiceBody(body: Record<string, unknown>) {
  const serviceName = body?.serviceName != null ? String(body.serviceName).trim() : undefined;
  if (serviceName !== undefined && !serviceName) throw new Error('serviceName cannot be empty');
  return {
    ...(serviceName !== undefined && { serviceName }),
    ...(body?.basePrice !== undefined && { basePrice: body.basePrice == null ? null : Number(body.basePrice) }),
    ...(body?.defaultDuration !== undefined && { defaultDuration: body.defaultDuration == null ? null : Number(body.defaultDuration) }),
    ...(body?.category !== undefined && { category: body.category == null ? null : String(body.category) }),
    ...(body?.minBookingNotice !== undefined && { minBookingNotice: body.minBookingNotice == null ? null : Number(body.minBookingNotice) }),
    ...(body?.gpsCheckInRequired !== undefined && { gpsCheckInRequired: body.gpsCheckInRequired === true }),
    ...(body?.photosRequired !== undefined && { photosRequired: body.photosRequired === true }),
    ...(body?.allowedSitterTiers !== undefined && { allowedSitterTiers: body.allowedSitterTiers == null ? null : (typeof body.allowedSitterTiers === 'string' ? body.allowedSitterTiers : JSON.stringify(body.allowedSitterTiers)) }),
    ...(body?.allowedSitterTypes !== undefined && { allowedSitterTypes: body.allowedSitterTypes == null ? null : (typeof body.allowedSitterTypes === 'string' ? body.allowedSitterTypes : JSON.stringify(body.allowedSitterTypes)) }),
    ...(body?.weekendMultiplier !== undefined && { weekendMultiplier: body.weekendMultiplier == null ? null : Number(body.weekendMultiplier) }),
    ...(body?.holidayMultiplier !== undefined && { holidayMultiplier: body.holidayMultiplier == null ? null : Number(body.holidayMultiplier) }),
    ...(body?.timeOfDayRules !== undefined && { timeOfDayRules: body.timeOfDayRules == null ? null : (typeof body.timeOfDayRules === 'string' ? body.timeOfDayRules : JSON.stringify(body.timeOfDayRules)) }),
    ...(body?.holidayBehavior !== undefined && { holidayBehavior: body.holidayBehavior == null ? null : (typeof body.holidayBehavior === 'string' ? body.holidayBehavior : JSON.stringify(body.holidayBehavior)) }),
    ...(body?.enabled !== undefined && { enabled: body.enabled === true }),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data = parseServiceBody(body);

    const updated = await db.$transaction(async (tx) => {
      const existing = await tx.serviceConfig.findFirst({ where: { id } });
      if (!existing) return null;
      return tx.serviceConfig.update({
        where: { id },
        data,
      });
    });

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (e instanceof Error && e.message === 'serviceName cannot be empty') {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const { id } = await params;

    const deleted = await db.$transaction(async (tx) => {
      const existing = await tx.serviceConfig.findFirst({ where: { id } });
      if (!existing) return null;
      await tx.serviceConfig.delete({ where: { id } });
      return true;
    });

    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw e;
  }
}
