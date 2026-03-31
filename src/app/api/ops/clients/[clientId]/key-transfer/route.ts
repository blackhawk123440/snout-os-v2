import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { logEvent } from '@/lib/log-event';

const KeyTransferSchema = z.object({
  action: z.enum(['give_to_sitter', 'return_to_client', 'give_to_owner']),
  sitterId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { clientId } = await params;

  try {
    const body = await request.json();
    const parsed = KeyTransferSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const db = getScopedDb(ctx);
    const { action, sitterId, notes } = parsed.data;

    const data: Record<string, unknown> = { keyNotes: notes || null };

    switch (action) {
      case 'give_to_sitter':
        data.keyStatus = 'with_sitter';
        data.keyHolder = sitterId || null;
        data.keyGivenAt = new Date();
        data.keyReturnedAt = null;
        break;
      case 'return_to_client':
        data.keyStatus = 'with_client';
        data.keyHolder = null;
        data.keyReturnedAt = new Date();
        break;
      case 'give_to_owner':
        data.keyStatus = 'with_owner';
        data.keyHolder = 'owner';
        data.keyGivenAt = new Date();
        break;
    }

    await db.client.update({ where: { id: clientId }, data });

    await logEvent({
      orgId: ctx.orgId,
      action: 'client.key_transfer',
      status: 'success',
      metadata: { clientId, action, sitterId },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}
