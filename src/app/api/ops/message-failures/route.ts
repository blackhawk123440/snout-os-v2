/**
 * GET /api/ops/message-failures
 * List last N failed message deliveries (MessageEvent deliveryStatus=failed).
 * Owner/admin only, org-scoped.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';

const DEFAULT_LIMIT = 50;

export async function GET(request: NextRequest) {
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

  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    100
  );

  const db = getScopedDb(ctx);
  const events = await db.messageEvent.findMany({
    where: {
      direction: 'outbound',
      deliveryStatus: 'failed',
    },
    include: {
      thread: {
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
          sitter: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const items = events.map((ev) => ({
    id: ev.id,
    threadId: ev.threadId,
    body: ev.body?.slice(0, 100) + (ev.body && ev.body.length > 100 ? '...' : ''),
    error: ev.providerErrorMessage ?? ev.failureDetail ?? ev.failureCode ?? 'Unknown error',
    errorCode: ev.providerErrorCode ?? ev.failureCode,
    createdAt: ev.createdAt.toISOString(),
    attemptCount: ev.attemptCount ?? 1,
    client: ev.thread?.client
      ? {
          id: ev.thread.client.id,
          name: `${ev.thread.client.firstName} ${ev.thread.client.lastName}`.trim() || 'Unknown',
        }
      : null,
    sitter: ev.thread?.sitter
      ? {
          id: ev.thread.sitter.id,
          name: `${ev.thread.sitter.firstName} ${ev.thread.sitter.lastName}`.trim() || 'Unknown',
        }
      : null,
  }));

  return NextResponse.json({
    items,
    count: items.length,
  });
}
