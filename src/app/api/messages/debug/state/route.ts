/**
 * Debug Endpoint for Message Thread State
 *
 * Owner-only endpoint to inspect thread state for QA/debugging.
 * HARDENED: Only available when:
 * - ENABLE_DEBUG_ENDPOINTS=true
 * - NODE_ENV !== "production" OR request host is in DEBUG_ALLOWED_HOSTS
 */

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireAnyRole } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

export async function GET(request: NextRequest) {
  // Hardened safety checks
  if (!env.ENABLE_DEBUG_ENDPOINTS) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Block in production unless explicitly allowed
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const allowedHosts = process.env.DEBUG_ALLOWED_HOSTS?.split(',').map(h => h.trim()) || [];
    const requestHost = request.headers.get('host') || '';

    if (!allowedHosts.includes(requestHost) && !allowedHosts.includes('*')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  // Require authentication and owner/admin role
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get threadId from query params
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get('threadId');

  if (!threadId) {
    return NextResponse.json({ error: 'threadId query parameter required' }, { status: 400 });
  }

  try {
    const db = getScopedDb(ctx);

    // Fetch thread with participants
    const thread = await (db as any).messageThread.findFirst({
      where: { id: threadId },
      include: {
        participants: true,
      },
    });

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Fetch message events
    const messages = await (db as any).messageEvent.findMany({
      where: { threadId },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    // Fetch active assignment windows
    const assignmentWindows = await (db as any).assignmentWindow.findMany({
      where: {
        threadId,
        startAt: { lte: new Date() },
        endAt: { gte: new Date() },
      },
      include: {
        sitter: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({
      thread: {
        id: thread.id,
        orgId: thread.orgId,
        scope: thread.scope,
        bookingId: thread.bookingId,
        assignedSitterId: thread.assignedSitterId,
        status: thread.status,
        messageNumberId: thread.messageNumberId,
      },
      participants: thread.participants.map((p: any) => ({
        id: p.id,
        role: p.role,
        userId: p.userId,
        clientId: p.clientId,
      })),
      assignmentWindows: assignmentWindows.map((w: any) => ({
        id: w.id,
        startAt: w.startAt,
        endAt: w.endAt,
        status: w.status,
        sitter: w.sitter ? {
          id: w.sitter.id,
          name: [w.sitter.firstName, w.sitter.lastName].filter(Boolean).join(' '),
        } : null,
      })),
      messages: messages.map((e: any) => ({
        id: e.id,
        direction: e.direction,
        body: e.body,
        deliveryStatus: e.deliveryStatus,
        createdAt: e.createdAt,
        providerMessageSid: e.providerMessageSid,
      })),
      auditEvents: [],
      violations: [],
    });
  } catch (error: any) {
    console.error('[DebugEndpoint] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
