/**
 * Get Thread Details Route
 *
 * GET /api/messages/threads/[id]
 * When NEXT_PUBLIC_API_URL is set: proxies to NestJS API.
 * Otherwise: reads from Prisma MessageThread (source of truth).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { assertMessagingThreadAccess, asMessagingActorRole } from '@/lib/messaging/send';
import { ensureThreadHasMessageNumber } from '@/lib/messaging/thread-number';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const threadId = params.id;
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await ensureThreadHasMessageNumber(ctx.orgId, threadId);
  const db = getScopedDb({ orgId: ctx.orgId });
  const t = await db.messageThread.findUnique({
    where: { id: threadId },
    include: {
      messageNumber: { select: { id: true, e164: true, numberClass: true, status: true } },
      assignmentWindows: {
        where: { endAt: { gte: new Date() } },
        orderBy: { startAt: 'desc' },
        take: 1,
      },
      client: { select: { id: true, firstName: true, lastName: true, phone: true } },
      sitter: { select: { id: true, firstName: true, lastName: true, phone: true } },
      conversationFlags: {
        where: { resolvedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, type: true, severity: true, createdAt: true },
      },
      availabilityRequests: {
        orderBy: { requestedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          requestedAt: true,
          respondedAt: true,
          responseLatencySec: true,
          sitterId: true,
        },
      },
    },
  });

  if (!t) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  }
  const role = asMessagingActorRole(ctx.role);
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    assertMessagingThreadAccess(
      {
        id: t.id,
        orgId: t.orgId,
        clientId: t.clientId,
        assignedSitterId: t.assignedSitterId,
        assignmentWindows: t.assignmentWindows,
      },
      { role, userId: ctx.userId, sitterId: ctx.sitterId, clientId: ctx.clientId },
      false
    );
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const thread = {
    id: t.id,
    orgId: t.orgId,
    clientId: t.clientId ?? '',
    sitterId: t.assignedSitterId ?? null,
    numberId: t.messageNumberId ?? '',
    threadType: (t.threadType ?? (t.messageNumber?.numberClass === 'sitter' ? 'assignment' : 'front_desk')) as
      | 'front_desk'
      | 'assignment'
      | 'pool'
      | 'other',
    laneType: t.laneType ?? 'company',
    activationStage: t.activationStage ?? 'intake',
    lifecycleStatus: t.lifecycleStatus ?? 'active',
    assignedRole: t.assignedRole ?? 'front_desk',
    clientApprovedAt: t.clientApprovedAt ? t.clientApprovedAt.toISOString() : null,
    sitterApprovedAt: t.sitterApprovedAt ? t.sitterApprovedAt.toISOString() : null,
    status: (t.status === 'open' ? 'active' : t.status === 'closed' || t.status === 'archived' ? 'inactive' : 'active') as
      | 'active'
      | 'inactive',
    ownerUnreadCount: t.ownerUnreadCount ?? 0,
    lastActivityAt: (t.lastMessageAt ?? t.createdAt).toISOString(),
    client: {
      id: t.client?.id ?? '',
      name: t.client ? `${t.client.firstName} ${t.client.lastName}`.trim() || 'Unknown' : 'Unknown',
      contacts: t.client?.phone ? [{ e164: t.client.phone }] : [],
    },
    sitter: t.sitter
      ? { id: t.sitter.id, name: `${t.sitter.firstName} ${t.sitter.lastName}`.trim(), phone: t.sitter.phone ?? null }
      : null,
    messageNumber: t.messageNumber
      ? {
          id: t.messageNumber.id,
          e164: t.messageNumber.e164 ?? '',
          class: t.messageNumber.numberClass ?? 'front_desk',
          status: t.messageNumber.status ?? 'active',
        }
      : { id: '', e164: '', class: 'front_desk' as const, status: 'active' },
    assignmentWindows: t.assignmentWindows.map((w) => ({
      id: w.id,
      startsAt: w.startAt.toISOString(),
      endsAt: w.endAt.toISOString(),
    })),
    serviceWindow: t.serviceWindowStart && t.serviceWindowEnd
      ? { startAt: t.serviceWindowStart.toISOString(), endAt: t.serviceWindowEnd.toISOString() }
      : null,
    graceEndsAt: t.graceEndsAt ? t.graceEndsAt.toISOString() : null,
    flags: (t.conversationFlags ?? []).map((flag) => ({
      id: flag.id,
      type: flag.type,
      severity: flag.severity,
      createdAt: flag.createdAt.toISOString(),
    })),
    availabilityResponses: (t.availabilityRequests ?? []).map((req) => ({
      id: req.id,
      status: req.status,
      requestedAt: req.requestedAt.toISOString(),
      respondedAt: req.respondedAt?.toISOString() ?? null,
      responseLatencySec: req.responseLatencySec ?? null,
      sitterId: req.sitterId,
    })),
  };

  return NextResponse.json(
    { thread },
    { status: 200, headers: { 'X-Snout-Route': 'prisma', 'X-Snout-OrgId': ctx.orgId } }
  );
}
