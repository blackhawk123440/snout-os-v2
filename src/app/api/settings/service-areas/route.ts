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
    const list = await db.orgServiceArea.findMany({
      where: {},
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ areas: list });
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
    const type = String(body?.type ?? 'zip');
    const config = body?.config != null ? (typeof body.config === 'string' ? body.config : JSON.stringify(body.config)) : null;
    const created = await db.orgServiceArea.create({
      data: {
        name,
        type,
        config,
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
