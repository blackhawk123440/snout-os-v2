/**
 * GET /api/ops/automation-failures
 * Returns automation events: tab=fail|dead|success
 */

import { NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';

const DEFAULT_LIMIT = 50;

function mapItem(f: any) {
  const metadata = f.metadata ? (typeof f.metadata === 'string' ? JSON.parse(f.metadata) : f.metadata) : null;
  return {
    id: f.id,
    eventType: f.eventType,
    automationType: f.automationType,
    status: f.status,
    error: f.error,
    bookingId: f.bookingId,
    orgId: f.orgId,
    metadata,
    attempts: metadata?.attempts,
    createdAt: f.createdAt,
  };
}

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 100);
  const tab = searchParams.get('tab') || 'fail';

  const db = getScopedDb(ctx);
  try {
    const where: Record<string, unknown> = {};
    if (tab === 'fail') {
      where.eventType = 'automation.failed';
    } else if (tab === 'dead') {
      where.eventType = 'automation.dead';
    } else if (tab === 'success') {
      where.eventType = { startsWith: 'automation.run.' };
      where.status = 'success';
    }

    const events = await db.eventLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: tab === 'success' ? 50 : limit,
    });

    const items = events.map(mapItem);

    return NextResponse.json({
      items,
      count: items.length,
      tab,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load', message }, { status: 500 });
  }
}
