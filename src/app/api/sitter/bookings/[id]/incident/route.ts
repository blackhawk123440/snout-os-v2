import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole } from '@/lib/rbac';
import { logEvent } from '@/lib/log-event';
import { publish, channels } from '@/lib/realtime/bus';

const IncidentSchema = z.object({
  type: z.enum(['injury', 'illness', 'escape', 'property_damage', 'bite', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(10).max(5000),
  mediaUrls: z.array(z.string()).max(10).optional(),
  petId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });

  const { id: bookingId } = await params;

  try {
    const db = getScopedDb(ctx);

    const body = await request.json();
    const parsed = IncidentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });

    const booking = await db.booking.findFirst({
      where: { id: bookingId, sitterId: ctx.sitterId },
      select: { id: true, clientId: true, firstName: true, lastName: true, service: true },
    });
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const d = parsed.data;

    const incident = await (db as any).incidentReport.create({
      data: {
        orgId: ctx.orgId,
        bookingId,
        sitterId: ctx.sitterId,
        clientId: booking.clientId,
        petId: d.petId || null,
        type: d.type,
        severity: d.severity,
        description: d.description,
        mediaUrls: d.mediaUrls ? JSON.stringify(d.mediaUrls) : null,
      },
    });

    // Health log
    if (d.petId) {
      await (db.petHealthLog as any).create({
        data: {
          petId: d.petId,
          sitterId: ctx.sitterId,
          type: 'alert',
          note: `${d.type}: ${d.description.slice(0, 200)}`,
        },
      });
    }

    // Get sitter name
    const sitter = await db.sitter.findUnique({
      where: { id: ctx.sitterId },
      select: { firstName: true, lastName: true },
    });
    const sitterName = sitter ? `${sitter.firstName} ${sitter.lastName}`.trim() : 'Sitter';

    // URGENT owner notification
    publish(channels.ownerOps(ctx.orgId), {
      type: 'visit.incident',
      severity: d.severity,
      incidentType: d.type,
      bookingId,
      sitterName,
      clientName: `${booking.firstName} ${booking.lastName}`.trim(),
      ts: Date.now(),
    }).catch(() => {});

    // Client notification
    if (booking.clientId) {
      void import('@/lib/notifications/triggers').then(({ notifyOwnerHealthConcern }) => {
        notifyOwnerHealthConcern({
          orgId: ctx.orgId,
          petId: d.petId || bookingId,
          petName: `${booking.firstName}'s pet`,
          sitterName,
          note: `${d.type}: ${d.description.slice(0, 80)}`,
        });
      }).catch(() => {});
    }

    await logEvent({
      orgId: ctx.orgId,
      action: 'visit.incident',
      bookingId,
      status: 'success',
      metadata: { incidentId: incident.id, type: d.type, severity: d.severity },
    });

    return NextResponse.json({ id: incident.id }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}
