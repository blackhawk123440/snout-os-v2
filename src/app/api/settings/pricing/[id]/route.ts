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
    const row = await db.pricingRule.findFirst({ where: { id } });
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.description !== undefined) data.description = body.description == null ? null : String(body.description);
    if (body.type !== undefined) data.type = String(body.type);
    if (body.conditions !== undefined) data.conditions = typeof body.conditions === 'string' ? body.conditions : JSON.stringify(body.conditions ?? {});
    if (body.calculation !== undefined) data.calculation = typeof body.calculation === 'string' ? body.calculation : JSON.stringify(body.calculation ?? {});
    if (body.priority !== undefined) data.priority = Number(body.priority);
    if (body.enabled !== undefined) data.enabled = body.enabled === true;

    const updated = await db.$transaction(async (tx) => {
      const existing = await tx.pricingRule.findFirst({ where: { id } });
      if (!existing) return null;
      return tx.pricingRule.update({
        where: { id },
        data: data as Parameters<typeof db.pricingRule.update>[0]['data'],
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
      const existing = await tx.pricingRule.findFirst({ where: { id } });
      if (!existing) return null;
      await tx.pricingRule.delete({ where: { id } });
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
