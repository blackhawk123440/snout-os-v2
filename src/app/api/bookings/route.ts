import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireAnyRole } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { parseCsv, parseDate, parsePage, parsePageSize } from '@/lib/pagination';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(request: NextRequest) {
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

  try {
    const db = getScopedDb(ctx);
    const url = (request as NextRequest).nextUrl ?? new URL(request.url);
    const params = url.searchParams;
    const page = parsePage(params.get('page'), 1);
    const pageSize = parsePageSize(params.get('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const statusList = parseCsv(params.get('status'));
    const paymentStatusList = parseCsv(params.get('paymentStatus'));
    const sitterId = params.get('sitterId')?.trim();
    const clientId = params.get('clientId')?.trim();
    const search = params.get('search')?.trim();
    const from = parseDate(params.get('from'));
    const to = parseDate(params.get('to'));
    const sortField = params.get('sort') === 'startAt' ? 'startAt' : 'createdAt';
    const sortDir = params.get('sortDir') === 'asc' ? 'asc' : 'desc';

    const where: Record<string, any> = {};
    if (statusList) where.status = { in: statusList };
    if (paymentStatusList) where.paymentStatus = { in: paymentStatusList };
    if (sitterId) where.sitterId = sitterId;
    if (clientId) where.clientId = clientId;
    if (from || to) {
      where.startAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { service: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, bookings] = await Promise.all([
      db.booking.count({ where }),
      db.booking.findMany({
        where,
        orderBy: [{ [sortField]: sortDir }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          address: true,
          service: true,
          startAt: true,
          endAt: true,
          status: true,
          paymentStatus: true,
          totalPrice: true,
          createdAt: true,
          sitter: {
            select: { id: true, firstName: true, lastName: true },
          },
          client: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);
    const bookingIds = bookings.map((b) => b.id);
    const reportRows = bookingIds.length
      ? await db.report.findMany({
          where: { bookingId: { in: bookingIds } },
          select: { bookingId: true },
          distinct: ['bookingId'],
        })
      : [];
    const hasReportByBookingId = new Set(reportRows.map((row) => row.bookingId));

    return NextResponse.json({
      items: bookings.map((b) => ({
        id: b.id,
        firstName: b.firstName,
        lastName: b.lastName,
        phone: b.phone,
        email: b.email,
        address: b.address,
        service: b.service,
        startAt: b.startAt,
        endAt: b.endAt,
        status: b.status,
        paymentStatus: b.paymentStatus,
        totalPrice: Number(b.totalPrice),
        sitter: b.sitter,
        client: b.client,
        createdAt: b.createdAt,
        hasReport: hasReportByBookingId.has(b.id),
      })),
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      sort: { field: sortField, direction: sortDir },
      filters: {
        status: statusList,
        paymentStatus: paymentStatusList,
        sitterId: sitterId ?? null,
        clientId: clientId ?? null,
        search: search ?? null,
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
      },
    });
  } catch (error: unknown) {
    console.error('[api/bookings] FULL ERROR:', error instanceof Error ? { message: error.message, stack: error.stack?.split('\n').slice(0,5) } : error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load bookings', message }, { status: 500 });
  }
}

