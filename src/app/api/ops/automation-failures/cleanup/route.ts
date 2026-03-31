/**
 * POST /api/ops/automation-failures/cleanup?olderThanDays=90
 * Deletes automation.failed and automation.dead events for the current org
 * older than the given days. Use to clear fixture/test data in staging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';

const DEFAULT_OLDER_THAN_DAYS = 90;
const MAX_OLDER_THAN_DAYS = 365;

export async function POST(request: NextRequest) {
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

  const days = Math.min(
    MAX_OLDER_THAN_DAYS,
    Math.max(1, parseInt(request.nextUrl.searchParams.get('olderThanDays') || String(DEFAULT_OLDER_THAN_DAYS), 10) || DEFAULT_OLDER_THAN_DAYS)
  );
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const db = getScopedDb(ctx);
  try {
    const result = await db.eventLog.deleteMany({
      where: {
        eventType: { in: ['automation.failed', 'automation.dead'] },
        createdAt: { lt: cutoff },
      },
    });
    return NextResponse.json({
      deleted: result.count,
      olderThanDays: days,
      cutoff: cutoff.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Cleanup failed', message }, { status: 500 });
  }
}
