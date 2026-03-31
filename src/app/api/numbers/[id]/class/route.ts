import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }

  const params = await context.params;
  const numberId = params.id;
  const db = getScopedDb({ orgId: ctx.orgId });

  let body: { class: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
  try {
    const updated = await db.messageNumber.update({
      where: { id: numberId },
      data: {
        numberClass: body.class,
        assignedSitterId: body.class === 'sitter' ? undefined : null,
      },
      include: {
        _count: { select: { MessageThread: { where: { status: 'open' } } } },
      },
    });
    return NextResponse.json({
      success: true,
      number: {
        id: updated.id,
        e164: updated.e164,
        class: updated.numberClass,
        status: updated.status,
        assignedSitterId: updated.assignedSitterId,
        assignedSitter: null,
        providerType: updated.provider,
        purchaseDate: updated.createdAt.toISOString(),
        lastUsedAt: updated.lastAssignedAt?.toISOString() ?? null,
        activeThreadCount: updated._count.MessageThread,
      },
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to change class' }, { status: 500 });
  }
}
