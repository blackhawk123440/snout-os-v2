import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';
import { logEvent } from '@/lib/log-event';
import { publish, channels } from '@/lib/realtime/bus';

const MeetGreetSchema = z.object({
  preferredDateTime: z.string().max(200),
  notes: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getScopedDb(ctx);
  try {
    const body = await request.json();
    const parsed = MeetGreetSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const client = await db.client.findFirst({
      where: { id: ctx.clientId },
      select: { firstName: true, lastName: true },
    });
    const clientName = client ? `${client.firstName} ${client.lastName}`.trim() : 'A client';

    // Find or create thread to owner
    const thread = await db.messageThread.findFirst({
      where: { clientId: ctx.clientId },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (thread) {
      const { sendThreadMessage } = await import('@/lib/messaging/send');
      const notesText = parsed.data.notes ? `\nNotes: ${parsed.data.notes}` : '';
      await sendThreadMessage({
        orgId: ctx.orgId,
        threadId: thread.id,
        body: `${clientName} would like to schedule a meet & greet.\nPreferred time: ${parsed.data.preferredDateTime}${notesText}`,
        actor: { role: 'client', clientId: ctx.clientId },
      });
    }

    // Notify owner
    publish(channels.ownerOps(ctx.orgId), {
      type: 'meet_greet.requested',
      clientName,
      preferredDateTime: parsed.data.preferredDateTime,
      ts: Date.now(),
    }).catch(() => {});

    await logEvent({
      orgId: ctx.orgId,
      action: 'meet_greet.requested',
      status: 'success',
      metadata: { clientId: ctx.clientId, clientName },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}
