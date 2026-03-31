import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireOwnerOrAdmin } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

type AttentionAction = 'mark_handled' | 'snooze_1h' | 'snooze_4h' | 'snooze_tomorrow';

function resolveSnoozeUntil(action: AttentionAction): Date | null {
  const now = new Date();
  if (action === 'snooze_1h') return new Date(now.getTime() + 60 * 60 * 1000);
  if (action === 'snooze_4h') return new Date(now.getTime() + 4 * 60 * 60 * 1000);
  if (action === 'snooze_tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  }
  return null;
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { id?: string; action?: AttentionAction };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const id = body.id?.trim();
  const action = body.action;
  if (!id || !action) {
    return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
  }

  const allowed = new Set<AttentionAction>([
    'mark_handled',
    'snooze_1h',
    'snooze_4h',
    'snooze_tomorrow',
  ]);
  if (!allowed.has(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  try {
    const db = getScopedDb(ctx);
    const handledAt = action === 'mark_handled' ? new Date() : null;
    const snoozedUntil = resolveSnoozeUntil(action);

    await db.commandCenterAttentionState.upsert({
      where: {
        orgId_itemKey: {
          orgId: ctx.orgId,
          itemKey: id,
        },
      },
      create: {
        orgId: ctx.orgId,
        itemKey: id,
        handledAt,
        snoozedUntil,
      },
      update: {
        handledAt,
        snoozedUntil,
      },
    });

    await db.eventLog.create({
      data: {
        orgId: ctx.orgId,
        eventType: 'ops.command_center.attention.action',
        status: 'success',
        metadata: JSON.stringify({
          actorUserId: ctx.userId ?? 'system',
          itemId: id,
          action,
          handledAt: handledAt?.toISOString() ?? null,
          snoozedUntil: snoozedUntil?.toISOString() ?? null,
          correlationId: ctx.correlationId,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      id,
      action,
      handledAt: handledAt?.toISOString() ?? null,
      snoozedUntil: snoozedUntil?.toISOString() ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to persist action', message }, { status: 500 });
  }
}
