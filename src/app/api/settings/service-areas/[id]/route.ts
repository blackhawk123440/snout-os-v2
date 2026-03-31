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
    const row = await db.orgServiceArea.findFirst({ where: { id } });
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
    if (body.type !== undefined) data.type = String(body.type);
    if (body.config !== undefined) data.config = body.config == null ? null : (typeof body.config === 'string' ? body.config : JSON.stringify(body.config));
    if (body.enabled !== undefined) data.enabled = body.enabled === true;

    const updated = await db.$transaction(async (tx) => {
      const existing = await tx.orgServiceArea.findFirst({ where: { id } });
      if (!existing) return null;
      return tx.orgServiceArea.update({
        where: { id },
        data: data as Parameters<typeof db.orgServiceArea.update>[0]['data'],
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
      const existing = await tx.orgServiceArea.findFirst({ where: { id } });
      if (!existing) return null;
      await tx.orgServiceArea.delete({ where: { id } });
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
