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
    const list = await db.discount.findMany({
      where: {},
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({
      discounts: list.map((d) => ({
        id: d.id,
        orgId: d.orgId,
        code: d.code,
        name: d.name,
        type: d.type,
        value: d.value,
        valueType: d.valueType,
        minBookingTotal: d.minBookingTotal,
        maxDiscount: d.maxDiscount,
        validFrom: d.validFrom,
        validUntil: d.validUntil,
        usageLimit: d.usageLimit,
        usageCount: d.usageCount,
        conditions: d.conditions,
        enabled: d.enabled,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw e;
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    const type = String(body?.type ?? 'automatic');
    const code = body?.code != null ? (body.code === '' ? null : String(body.code).trim()) : null;
    if (type === 'code' && !code) {
      return NextResponse.json({ error: 'code is required for type "code"' }, { status: 400 });
    }
    const value = Number(body?.value);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: 'value must be a non-negative number' }, { status: 400 });
    }
    const valueType = body?.valueType === 'fixed' ? 'fixed' : 'percentage';
    const created = await db.discount.create({
      data: {
        code: type === 'code' ? code : null,
        name,
        type,
        value,
        valueType,
        minBookingTotal: body?.minBookingTotal != null ? Number(body.minBookingTotal) : null,
        maxDiscount: body?.maxDiscount != null ? Number(body.maxDiscount) : null,
        validFrom: body?.validFrom ? new Date(body.validFrom) : null,
        validUntil: body?.validUntil ? new Date(body.validUntil) : null,
        usageLimit: body?.usageLimit != null ? Number(body.usageLimit) : null,
        conditions: body?.conditions != null ? (typeof body.conditions === 'string' ? body.conditions : JSON.stringify(body.conditions)) : null,
        enabled: body?.enabled !== false,
      },
    });
    return NextResponse.json(created);
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw e;
  }
}
