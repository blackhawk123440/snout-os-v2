import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { logEvent } from '@/lib/log-event';
import { publish, channels } from '@/lib/realtime/bus';

const ComplaintSchema = z.object({
  issueType: z.enum(['late_arrival', 'missed_service', 'safety_concern', 'billing_issue', 'other']),
  description: z.string().min(20).max(2000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = ComplaintSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const db = getScopedDb(ctx);
    const booking = await db.booking.findFirst({
      where: { id, clientId: ctx.clientId },
      select: { id: true, firstName: true, lastName: true, service: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    await logEvent({
      orgId: ctx.orgId,
      action: 'client.complaint',
      bookingId: id,
      status: 'success',
      metadata: {
        issueType: parsed.data.issueType,
        description: parsed.data.description,
        clientId: ctx.clientId,
        clientName: `${booking.firstName} ${booking.lastName}`.trim(),
      },
    });

    publish(channels.ownerOps(ctx.orgId), {
      type: 'client.complaint',
      bookingId: id,
      issueType: parsed.data.issueType,
      ts: Date.now(),
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to submit complaint', message }, { status: 500 });
  }
}
