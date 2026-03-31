/**
 * POST /api/ops/clients/[clientId]/export
 * Owner/admin only. Exports all client data as JSON (GDPR).
 * Validates clientId belongs to org.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireOwnerOrAdmin } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { buildClientExportBundle } from '@/lib/export-client-data';
import { logEvent } from '@/lib/log-event';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { clientId } = await params;
  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  }

  const db = getScopedDb(ctx);

  try {
    const client = await db.client.findFirst({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    await logEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId ?? undefined,
      action: 'client.export.requested',
      entityType: 'client',
      entityId: clientId,
      metadata: { clientId, requestedBy: 'owner_or_admin' },
    });

    const bundle = await buildClientExportBundle(db as any, ctx.orgId, clientId);

    await logEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId ?? undefined,
      action: 'client.export.completed',
      entityType: 'client',
      entityId: clientId,
      metadata: { clientId },
    });

    return NextResponse.json(bundle, {
      headers: {
        'Content-Disposition': `attachment; filename="client-export-${clientId}-${Date.now()}.json"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to export client data', message },
      { status: 500 }
    );
  }
}
