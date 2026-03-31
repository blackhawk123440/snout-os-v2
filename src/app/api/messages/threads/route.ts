import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ensureThreadHasMessageNumber } from '@/lib/messaging/thread-number';
import { createClientContact, findClientContactByPhone } from '@/lib/messaging/client-contact-lookup';

const GetQuerySchema = z.object({
  orgId: z.string().min(1).optional(),
  sitterId: z.string().optional(),
  clientId: z.string().optional(),
  status: z.string().optional(),
  unreadOnly: z.coerce.boolean().optional(),
  scope: z.string().optional(),
  inbox: z.string().optional(),
  limit: z.coerce.number().int().min(1).default(50),
  pageSize: z.coerce.number().int().min(1).optional(),
  cursor: z.string().optional(),
  bookingId: z.string().optional(),
  participant: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = (req as NextRequest).nextUrl ?? new URL(req.url);
  const parsed = GetQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });

  const {
    sitterId,
    clientId,
    status,
    unreadOnly,
    scope,
    inbox,
    limit,
    pageSize,
    cursor,
    bookingId,
    participant,
    from,
    to,
  } = parsed.data;
  const pageLimit = Math.min(pageSize ?? limit, 200);

  const where: {
    assignedSitterId?: string | null;
    clientId?: string;
    status?: string;
    threadType?: string;
    ownerUnreadCount?: { gt: number };
    bookingId?: string;
    updatedAt?: { gte?: Date; lte?: Date };
    OR?: Array<Record<string, any>>;
  } = {};
  if (sitterId) where.assignedSitterId = sitterId;
  if (clientId) where.clientId = clientId;
  if (bookingId) where.bookingId = bookingId;
  if (status) where.status = status;
  if (unreadOnly) where.ownerUnreadCount = { gt: 0 };
  if (scope === 'internal' || inbox === 'owner') {
    where.threadType = 'front_desk';
    where.assignedSitterId = null;
  }
  if (ctx.role === 'sitter') {
    where.assignedSitterId = ctx.sitterId ?? '__no_sitter__';
  }
  if (ctx.role === 'client') {
    if (!ctx.clientId) return NextResponse.json({ error: 'Client context missing' }, { status: 403 });
    where.clientId = ctx.clientId;
  }
  if (!['owner', 'admin', 'sitter', 'client'].includes(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    where.updatedAt = { ...(where.updatedAt ?? {}), gte: fromDate };
  }
  if (toDate && !Number.isNaN(toDate.getTime())) {
    where.updatedAt = { ...(where.updatedAt ?? {}), lte: toDate };
  }
  if (participant) {
    const term = participant.trim();
    if (term) {
      where.OR = [
        { client: { firstName: { contains: term, mode: 'insensitive' } } },
        { client: { lastName: { contains: term, mode: 'insensitive' } } },
        { sitter: { firstName: { contains: term, mode: 'insensitive' } } },
        { sitter: { lastName: { contains: term, mode: 'insensitive' } } },
        { maskedNumberE164: { contains: term } },
      ];
    }
  }

  const db = getScopedDb({ orgId: ctx.orgId });
  const shouldRunRepairSweep =
    !cursor &&
    ((ctx.role === "owner" || ctx.role === "admin") &&
      Math.random() < Number(process.env.THREAD_NUMBER_REPAIR_SAMPLE_RATE || "0.15"));
  if (shouldRunRepairSweep) {
    const missingLinks = await db.messageThread.findMany({
      where: { messageNumberId: null },
      select: { id: true },
      take: 10,
      orderBy: { updatedAt: "desc" },
    });
    // Keep this opportunistic and sampled to avoid read-path amplification under load.
    void Promise.allSettled(missingLinks.map((t) => ensureThreadHasMessageNumber(ctx.orgId, t.id)));
  }
  const rows = await db.messageThread.findMany({
    where,
    take: pageLimit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    include: {
      messageNumber: { select: { id: true, e164: true, numberClass: true, status: true } },
      assignmentWindows: {
        where: { endAt: { gte: new Date() } },
        orderBy: { startAt: 'desc' },
        take: 1,
        select: { id: true, sitterId: true, startAt: true, endAt: true },
      },
      client: { select: { id: true, firstName: true, lastName: true } },
      sitter: { select: { id: true, firstName: true, lastName: true } },
      conversationFlags: {
        where: { resolvedAt: null },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, type: true, severity: true, createdAt: true },
      },
      availabilityRequests: {
        orderBy: { requestedAt: "desc" },
        take: 3,
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

  const hasMore = rows.length > pageLimit;
  const items = hasMore ? rows.slice(0, pageLimit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const threads = items.map((t) => ({
    id: t.id,
    orgId: t.orgId,
    bookingId: t.bookingId ?? null,
    clientId: t.clientId ?? '',
    sitterId: t.assignedSitterId ?? null,
    numberId: t.messageNumberId ?? '',
    threadType: t.threadType ?? (t.messageNumber?.numberClass === 'sitter' ? 'assignment' : 'front_desk'),
    laneType: t.laneType ?? 'company',
    activationStage: t.activationStage ?? 'intake',
    lifecycleStatus: t.lifecycleStatus ?? 'active',
    assignedRole: t.assignedRole ?? 'front_desk',
    clientApprovedAt: t.clientApprovedAt ? t.clientApprovedAt.toISOString() : null,
    sitterApprovedAt: t.sitterApprovedAt ? t.sitterApprovedAt.toISOString() : null,
    status: t.status === 'open' ? 'active' : t.status === 'closed' || t.status === 'archived' ? 'inactive' : 'active',
    ownerUnreadCount: t.ownerUnreadCount ?? 0,
    lastActivityAt: (t.lastMessageAt ?? t.createdAt).toISOString(),
    client: {
      id: t.client?.id ?? '',
      name: t.client ? `${t.client.firstName} ${t.client.lastName}`.trim() || 'Unknown' : 'Unknown',
      contacts: [],
    },
    sitter: t.sitter
      ? { id: t.sitter.id, name: `${t.sitter.firstName} ${t.sitter.lastName}`.trim() }
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
  }));

  return NextResponse.json(
    {
      items: threads,
      nextCursor,
      hasMore,
      pageSize: pageLimit,
      sort: { field: 'lastMessageAt', direction: 'desc' },
      filters: {
        sitterId: sitterId ?? null,
        clientId: clientId ?? null,
        status: status ?? null,
        unreadOnly: unreadOnly ?? null,
        scope: scope ?? null,
        inbox: inbox ?? null,
        bookingId: bookingId ?? null,
        participant: participant ?? null,
        from: fromDate?.toISOString() ?? null,
        to: toDate?.toISOString() ?? null,
      },
    },
    { status: 200, headers: { 'X-Snout-Route': 'prisma', 'X-Snout-OrgId': ctx.orgId } }
  );
}

const PostBodySchema = z.object({
  phoneNumber: z.string().min(10),
  initialMessage: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner/admin access required' }, { status: 403 });
  }
  const orgId = ctx.orgId;
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const parsed = PostBodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const { phoneNumber, initialMessage } = parsed.data;
    const normalizedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

    const db = getScopedDb({ orgId });
    let client = await db.client.findFirst({
      where: { phone: normalizedPhone },
    });

    if (!client) {
      client = await db.client.create({
        data: {
          firstName: 'Guest',
          lastName: normalizedPhone,
          phone: normalizedPhone,
        },
      });
    }
    const existingContact = await findClientContactByPhone(orgId, normalizedPhone);
    if (!existingContact) {
      await createClientContact({
        id: randomUUID(),
        orgId,
        clientId: client.id,
        e164: normalizedPhone,
        label: 'Mobile',
        verified: false,
      }).catch(() => {});
    }

    let thread = await db.messageThread.findFirst({
      where: { clientId: client.id },
    });
    const reused = !!thread;

    if (!thread) {
      const frontDeskNumber = await db.messageNumber.findFirst({
        where: { numberClass: 'front_desk', status: 'active' },
      });

      if (!frontDeskNumber) {
        return NextResponse.json(
          { error: 'Front desk number not configured. Please set up messaging numbers first.' },
          { status: 400 }
        );
      }

      thread = await db.messageThread.create({
        data: {
          orgId,
          clientId: client.id,
          messageNumberId: frontDeskNumber.id,
          threadType: 'front_desk',
          numberClass: 'front_desk',
          scope: 'client_general',
          status: 'open',
          maskedNumberE164: frontDeskNumber.e164,
        },
      });

      const clientName = `${client.firstName} ${client.lastName}`.trim() || 'Client';
      const userId = ctx.userId ?? null;
      await db.messageParticipant.createMany({
        data: [
          {
            threadId: thread.id,
            orgId,
            role: 'client',
            clientId: client.id,
            displayName: clientName,
            realE164: normalizedPhone,
          },
          {
            threadId: thread.id,
            orgId,
            role: 'owner',
            userId,
            displayName: 'Owner',
            realE164: frontDeskNumber.e164,
          },
        ],
      });
    }

    if (initialMessage) {
      try {
        const sendRes = await fetch(`${req.nextUrl.origin}/api/messages/threads/${thread.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('Cookie') ?? '' },
          body: JSON.stringify({ body: initialMessage, forceSend: false }),
        });
        if (!sendRes.ok) console.error('[Thread Creation] Failed to send initial message:', await sendRes.text());
      } catch (err) {
        console.error('[Thread Creation] Error sending initial message:', err);
      }
    }

    return NextResponse.json(
      { threadId: thread.id, clientId: client.id, reused },
      { status: 200, headers: { 'X-Snout-Route': 'prisma', 'X-Snout-OrgId': orgId } }
    );
  } catch (error: any) {
    console.error('[Messages Threads POST] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to create thread', details: error?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
