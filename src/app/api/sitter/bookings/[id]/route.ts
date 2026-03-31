import { NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';

const CHECKLIST_TYPES = ['arrived', 'leash', 'fed', 'water', 'meds', 'locked_door'] as const;

const parseAddress = (address: string | null | undefined) => {
  if (!address) {
    return { line1: null, line2: null, city: null, state: null, zip: null, full: null };
  }
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const line1 = parts[0] ?? null;
  const line2 = parts.length > 3 ? parts.slice(1, parts.length - 2).join(', ') : null;
  const city = parts.length >= 2 ? parts[parts.length - 2] : null;
  const stateZip = parts.length >= 1 ? parts[parts.length - 1] : '';
  const stateZipMatch = stateZip.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  const state = stateZipMatch?.[1] ?? null;
  const zip = stateZipMatch?.[2] ?? null;
  return { line1, line2, city, state, zip, full: address };
};

const buildMapLinks = (address: string | null | undefined) => {
  if (!address) return { apple: null, google: null };
  const encoded = encodeURIComponent(address);
  return {
    apple: `https://maps.apple.com/?q=${encoded}`,
    google: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  };
};

/**
 * GET /api/sitter/bookings/[id]
 * Returns a single booking for the current sitter. Requires SITTER role.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter profile missing on session' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const db = getScopedDb(ctx);

    const booking = await db.booking.findFirst({
      where: {
        id,
      },
      include: {
        pets: { select: { id: true, name: true, species: true, breed: true, notes: true } },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            notes: true,
            emergencyContacts: {
              where: { orgId: ctx.orgId },
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { name: true, phone: true, relationship: true },
            },
          },
        },
        checklistItems: {
          where: { orgId: ctx.orgId },
          select: { type: true, checkedAt: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    if (booking.sitterId !== ctx.sitterId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const thread = await db.messageThread.findFirst({
      where: {
        bookingId: booking.id,
        assignedSitterId: ctx.sitterId,
      },
      select: { id: true },
    });

    const latestVisitEvent = await db.visitEvent.findFirst({
      where: { bookingId: booking.id, sitterId: ctx.sitterId },
      orderBy: { createdAt: 'desc' },
      select: {
        checkInAt: true,
        checkOutAt: true,
      },
    });

    const latestReport = await db.report.findFirst({
      where: { bookingId: booking.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });

    const toIso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d);
    const toIsoNullable = (d: Date | string | null | undefined) =>
      d ? (d instanceof Date ? d.toISOString() : d) : null;
    const parsedAddress = parseAddress(booking.address);
    const mapLink = buildMapLinks(booking.address);
    const checklistByType = new Map(
      (booking.checklistItems ?? []).map((item) => [item.type, item.checkedAt] as const)
    );

    return NextResponse.json({
      id: booking.id,
      status: booking.status,
      service: booking.service,
      startAt: toIso(booking.startAt),
      endAt: toIso(booking.endAt),
      updatedAt: toIso(booking.updatedAt),
      address: booking.address,
      addressLine1: parsedAddress.line1,
      addressLine2: parsedAddress.line2,
      addressCity: parsedAddress.city,
      addressState: parsedAddress.state,
      addressZip: parsedAddress.zip,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      entryInstructions: booking.entryInstructions,
      doorCode: booking.doorCode,
      notes: booking.notes,
      totalPrice: booking.totalPrice,
      clientName:
        `${booking.client?.firstName || ''} ${booking.client?.lastName || ''}`.trim() || 'Client',
      addressParts: parsedAddress,
      mapLink,
      client: {
        firstName: booking.client?.firstName,
        lastName: booking.client?.lastName,
        phone: booking.client?.phone,
        email: booking.client?.email,
        notes: booking.client?.notes ?? null,
      },
      emergencyContact: booking.client?.emergencyContacts?.[0] ?? null,
      pets: booking.pets.map((pet) => {
        const noteText = (pet.notes ?? '').toLowerCase();
        return {
          ...pet,
          careNotes: pet.notes ?? null,
          flags: {
            hasMedication: /\bmed|medication|pill|dose\b/.test(noteText),
            hasAllergies: /\ballerg|allergy\b/.test(noteText),
          },
        };
      }),
      threadId: thread?.id ?? null,
      timeline: {
        scheduledStart: toIso(booking.startAt),
        scheduledEnd: toIso(booking.endAt),
        checkedInAt: toIsoNullable(latestVisitEvent?.checkInAt),
        checkedOutAt: toIsoNullable(latestVisitEvent?.checkOutAt),
        report: {
          hasReport: !!latestReport,
          latestReportId: latestReport?.id ?? null,
          latestReportAt: toIsoNullable(latestReport?.createdAt),
        },
      },
      checklist: CHECKLIST_TYPES.map((type) => ({
        type,
        checkedAt: toIsoNullable(checklistByType.get(type)),
      })),
      supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load booking', message },
      { status: 500 }
    );
  }
}
