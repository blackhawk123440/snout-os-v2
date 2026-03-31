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
    const list = await db.pricingRule.findMany({
      where: {},
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
    return NextResponse.json({ rules: list });
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
    const type = String(body?.type ?? 'fee');
    const conditions = typeof body?.conditions === 'string' ? body.conditions : JSON.stringify(body?.conditions ?? {});
    const calculation = typeof body?.calculation === 'string' ? body.calculation : JSON.stringify(body?.calculation ?? {});
    const priority = Number(body?.priority);
    const created = await db.pricingRule.create({
      data: {
        name,
        description: body?.description != null ? String(body.description) : null,
        type,
        conditions,
        calculation,
        priority: Number.isFinite(priority) ? priority : 0,
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
