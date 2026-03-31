import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }

  const db = getScopedDb({ orgId: ctx.orgId });
  const numberClass = request.nextUrl.searchParams.get('class') ?? undefined;
  const status = request.nextUrl.searchParams.get('status') ?? undefined;
  const search = request.nextUrl.searchParams.get('search')?.trim() ?? undefined;

  const rows = await db.messageNumber.findMany({
    where: {
      orgId: ctx.orgId,
      ...(numberClass ? { numberClass } : {}),
      ...(status ? { status } : {}),
      ...(search ? { e164: { contains: search } } : {}),
    },
    include: {
      sitterMaskedNumber: {
        include: { sitter: { select: { id: true, firstName: true, lastName: true } } },
      },
      _count: {
        select: { MessageThread: { where: { status: 'open' } } },
      },
    },
    orderBy: [{ numberClass: 'asc' }, { e164: 'asc' }],
  });

  const response = rows.map((n) => ({
    id: n.id,
    e164: n.e164,
    orgId: n.orgId,
    numberClass: (n.numberClass ?? 'pool') as 'front_desk' | 'sitter' | 'pool',
    class: (n.numberClass ?? 'pool') as 'front_desk' | 'sitter' | 'pool',
    status: (['quarantined', 'inactive', 'released'].includes(n.status) ? n.status : 'active') as
      | 'active'
      | 'quarantined'
      | 'inactive'
      | 'released',
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
  }));

  return NextResponse.json(response, {
    status: 200,
    headers: { 'X-Snout-Route': 'prisma', 'X-Snout-OrgId': ctx.orgId },
  });
}
