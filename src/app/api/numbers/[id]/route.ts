import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

export async function GET(
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
  const n = await db.messageNumber.findFirst({
    where: { id: numberId, orgId: ctx.orgId },
    include: {
      sitterMaskedNumber: {
        include: { sitter: { select: { id: true, firstName: true, lastName: true } } },
      },
      _count: {
        select: { MessageThread: { where: { status: 'open' } } },
      },
    },
  });

  if (!n) {
    return NextResponse.json({ error: 'Number not found' }, { status: 404 });
  }

  return NextResponse.json(
    {
      id: n.id,
      e164: n.e164,
      class: (n.numberClass ?? 'pool') as 'front_desk' | 'sitter' | 'pool',
      status: (n.status === 'quarantined' || n.status === 'inactive' ? n.status : 'active') as
        | 'active'
        | 'quarantined'
        | 'inactive',
      assignedSitterId: n.assignedSitterId ?? null,
      assignedSitter: n.sitterMaskedNumber?.sitter
        ? {
            id: n.sitterMaskedNumber.sitter.id,
            name: `${n.sitterMaskedNumber.sitter.firstName} ${n.sitterMaskedNumber.sitter.lastName}`.trim(),
          }
        : null,
      providerType: n.provider ?? 'twilio',
      purchaseDate: n.createdAt.toISOString(),
      lastUsedAt: n.lastAssignedAt?.toISOString() ?? null,
      quarantineReleaseAt: null,
      quarantinedReason: null,
      activeThreadCount: n._count.MessageThread,
      capacityStatus: n._count.MessageThread > 0 ? 'in_use' : 'available',
      maxConcurrentThreads: null,
      health: { status: n.status ?? 'active', deliveryRate: null, errorRate: null },
      deliveryErrors: [],
    },
    { status: 200, headers: { 'X-Snout-Route': 'prisma', 'X-Snout-OrgId': ctx.orgId } }
  );
}
