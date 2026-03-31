import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';
import { calculateBookingPrice } from '@/lib/rates';
import { emitBookingCreated } from '@/lib/event-emitter';
import { ensureEventQueueBridge } from '@/lib/event-queue-bridge-init';
import { emitAndEnqueueBookingEvent } from '@/lib/booking/booking-events';
import { parseCsv, parseDate, parsePage, parsePageSize } from '@/lib/pagination';
import { syncConversationLifecycleWithBookingWorkflow } from '@/lib/messaging/conversation-service';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
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

  try {
    const db = getScopedDb(ctx);
    const url = (request as NextRequest).nextUrl ?? new URL(request.url);
    const params = url.searchParams;
    const page = parsePage(params.get('page'), 1);
    const pageSize = parsePageSize(params.get('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const statusList = parseCsv(params.get('status'));
    const paymentStatusList = parseCsv(params.get('paymentStatus'));
    const from = parseDate(params.get('from'));
    const to = parseDate(params.get('to'));

    const where: Record<string, any> = { clientId: ctx.clientId };
    if (statusList) where.status = { in: statusList };
    if (paymentStatusList) where.paymentStatus = { in: paymentStatusList };
    if (from || to) {
      where.startAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const total = await db.booking.count({ where });
    const bookings = await db.booking.findMany({
      where,
      select: {
        id: true,
        service: true,
        startAt: true,
        endAt: true,
        status: true,
        address: true,
        sitterId: true,
        sitter: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ startAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Batch-fetch thread IDs for each booking (for message buttons)
    const bookingIds = bookings.map((b: any) => b.id);
    const threads = bookingIds.length > 0
      ? await db.messageThread.findMany({
          where: { orgId: ctx.orgId, bookingId: { in: bookingIds } },
          select: { id: true, bookingId: true },
        })
      : [];
    const threadByBooking = new Map(threads.map((t: any) => [t.bookingId, t.id]));

    const toIso = (d: Date) => (d instanceof Date ? d.toISOString() : String(d));
    const items = bookings.map((b: any) => ({
      id: b.id,
      service: b.service,
      startAt: toIso(b.startAt),
      endAt: toIso(b.endAt),
      status: b.status,
      address: b.address,
      sitter: b.sitter
        ? { id: b.sitter.id, name: [b.sitter.firstName, b.sitter.lastName].filter(Boolean).join(' ').trim() || 'Sitter' }
        : null,
      threadId: threadByBooking.get(b.id) || null,
    }));

    return NextResponse.json({
      items,
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      sort: { field: 'startAt', direction: 'desc' },
      filters: {
        status: statusList,
        paymentStatus: paymentStatusList,
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load bookings', message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);

    // Outstanding balance check — block new bookings if client has unpaid ones
    try {
      const { checkOutstandingBalance } = await import('@/lib/outstanding-balance');
      const balance = await checkOutstandingBalance({ orgId: ctx.orgId, clientId: ctx.clientId! });
      if (balance.hasOutstanding) {
        return NextResponse.json({
          error: 'outstanding_balance',
          message: `Outstanding balance of $${balance.totalOutstanding.toFixed(2)}. Please pay existing bookings first.`,
          outstandingBookings: balance.bookings,
        }, { status: 402 });
      }
    } catch (balanceError) {
      console.error('[client/bookings] Balance check failed (non-blocking):', balanceError);
    }

    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      address?: string | null;
      pickupAddress?: string | null;
      dropoffAddress?: string | null;
      service?: string;
      startAt?: string;
      endAt?: string;
      quantity?: number;
      pets?: Array<{ name?: string; species?: string }>;
      notes?: string | null;
      afterHours?: boolean;
      holiday?: boolean;
    };

    const service = typeof body.service === 'string' ? body.service.trim() : '';
    const startAt = body.startAt ? new Date(body.startAt) : null;
    const endAt = body.endAt ? new Date(body.endAt) : null;
    if (!service || !startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return NextResponse.json(
        { error: 'Missing required fields: service, startAt, endAt' },
        { status: 400 }
      );
    }
    if (endAt <= startAt) {
      return NextResponse.json({ error: 'endAt must be after startAt' }, { status: 400 });
    }

    const client = await db.client.findFirst({
      where: { id: ctx.clientId },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, orgId: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    }

    const petsInput = Array.isArray(body.pets) ? body.pets : [];
    const pets = petsInput
      .map((p) => ({
        name: (p?.name || '').trim(),
        species: (p?.species || '').trim(),
      }))
      .filter((p) => p.name && p.species);

    const quantity = typeof body.quantity === 'number' && body.quantity > 0 ? body.quantity : 1;
    const afterHours = Boolean(body.afterHours);

    const pricing = await calculateBookingPrice(
      service,
      startAt,
      endAt,
      pets.length || 1,
      quantity,
      afterHours
    );

    const booking = await db.booking.create({
      data: {
        clientId: client.id,
        firstName: body.firstName?.trim() || client.firstName || 'Client',
        lastName: body.lastName?.trim() || client.lastName || 'User',
        phone: body.phone?.trim() || client.phone,
        email: body.email?.trim() || client.email || null,
        address: body.address?.trim() || null,
        pickupAddress: body.pickupAddress?.trim() || null,
        dropoffAddress: body.dropoffAddress?.trim() || null,
        service,
        startAt,
        endAt,
        totalPrice: pricing.total,
        status: 'pending',
        paymentStatus: 'unpaid',
        notes: body.notes?.trim() || null,
        quantity,
        afterHours,
        holiday: Boolean(body.holiday),
        pets: {
          create: (pets.length > 0 ? pets : [{ name: 'Pet', species: 'Dog' }]).map((p) => ({
            name: p.name,
            species: p.species,
          })),
        },
      },
      include: { pets: true, timeSlots: true },
    });
    let lifecycleSyncError: { code?: string; message: string } | null = null;
    try {
      await syncConversationLifecycleWithBookingWorkflow({
        orgId: ctx.orgId,
        bookingId: booking.id,
        clientId: booking.clientId ?? ctx.clientId,
        phone: booking.phone,
        firstName: booking.firstName,
        lastName: booking.lastName,
        bookingStatus: booking.status,
        sitterId: booking.sitterId,
        serviceWindowStart: booking.startAt,
        serviceWindowEnd: booking.endAt,
      });
    } catch (conversationError: unknown) {
      const err = conversationError as { code?: string; message?: string };
      const code = err?.code != null ? String(err.code) : undefined;
      const message = err?.message != null ? String(err.message) : String(conversationError);
      lifecycleSyncError = { ...(code ? { code } : {}), message };
      console.error(
        '[api/client/bookings] company lane ensure failed (non-blocking):',
        code ?? '',
        message
      );
    }

    await ensureEventQueueBridge();
    try {
      await emitBookingCreated(booking, ctx.correlationId);
    } catch (eventError) {
      console.error('[api/client/bookings] emitBookingCreated failed (non-blocking):', eventError);
    }
    emitAndEnqueueBookingEvent('booking.created', {
      orgId: ctx.orgId,
      bookingId: booking.id,
      clientId: booking.clientId ?? undefined,
      sitterId: booking.sitterId ?? undefined,
      occurredAt: new Date().toISOString(),
      correlationId: ctx.correlationId,
      metadata: {
        service: booking.service,
        status: booking.status,
        firstName: booking.firstName,
        lastName: booking.lastName,
        phone: booking.phone,
      },
    }).catch((err) => console.error('[api/client/bookings] emitAndEnqueueBookingEvent failed:', err));

    // Fire-and-forget notifications
    void import('@/lib/notifications/triggers').then(({ notifyClientBookingReceived, notifyOwnerNewBooking }) => {
      notifyClientBookingReceived({
        orgId: ctx.orgId,
        bookingId: booking.id,
        clientId: booking.clientId ?? ctx.clientId,
        clientFirstName: booking.firstName,
        service: booking.service,
        startAt: booking.startAt,
        phone: booking.phone,
        pets: booking.pets,
        timeSlots: booking.timeSlots,
        totalPrice: Number(booking.totalPrice) || undefined,
        address: booking.address,
        notes: booking.notes,
      });
      notifyOwnerNewBooking({
        orgId: ctx.orgId,
        bookingId: booking.id,
        clientName: `${booking.firstName} ${booking.lastName}`.trim(),
        service: booking.service,
        startAt: booking.startAt,
      });
    }).catch(() => {});

    const res: { success: true; booking: { id: string; totalPrice: number; status: string }; orgId?: string; lifecycleSyncError?: { code?: string; message: string } } = {
      success: true,
      booking: {
        id: booking.id,
        totalPrice: Number(booking.totalPrice),
        status: booking.status,
      },
    };
    res.orgId = ctx.orgId;
    if (lifecycleSyncError) res.lifecycleSyncError = lifecycleSyncError;
    return NextResponse.json(res);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create booking', message },
      { status: 500 }
    );
  }
}
