/**
 * GET /api/client/export
 * Client self-export (GDPR). Exports only the authenticated client's data.
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { buildClientExportBundle } from '@/lib/export-client-data';
import { logEvent } from '@/lib/log-event';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getScopedDb(ctx);
  const clientId = ctx.clientId!;

  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { deletedAt: true },
  });
  if (client?.deletedAt) {
    return NextResponse.json({ error: "Account has been deleted; export is no longer available" }, { status: 403 });
  }

  try {
    await logEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId ?? undefined,
      action: 'client.export.requested',
      entityType: 'client',
      entityId: clientId,
      metadata: { clientId, requestedBy: 'client_self' },
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
        'Content-Disposition': `attachment; filename="my-data-export-${Date.now()}.json"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to export your data', message },
      { status: 500 }
    );
  }
}
