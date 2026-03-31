import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';

function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseBoolean(value: unknown): boolean {
  return value === true;
}

function parseBody(body: any) {
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) {
      throw new Error('name cannot be empty');
    }
    data.name = name;
  }
  if (body.pointTarget !== undefined) {
    const pointTarget = Number(body.pointTarget);
    if (!Number.isFinite(pointTarget) || pointTarget < 0) {
      throw new Error('pointTarget must be a non-negative number');
    }
    data.pointTarget = pointTarget;
  }
  if (body.minCompletionRate !== undefined) {
    const minCompletionRate = parseOptionalNumber(body.minCompletionRate);
    if (minCompletionRate !== null && (minCompletionRate < 0 || minCompletionRate > 100)) {
      throw new Error('minCompletionRate must be between 0 and 100');
    }
    data.minCompletionRate = minCompletionRate;
  }
  if (body.minResponseRate !== undefined) {
    const minResponseRate = parseOptionalNumber(body.minResponseRate);
    if (minResponseRate !== null && (minResponseRate < 0 || minResponseRate > 100)) {
      throw new Error('minResponseRate must be between 0 and 100');
    }
    data.minResponseRate = minResponseRate;
  }
  if (body.priorityLevel !== undefined) {
    const priorityLevel = Number(body.priorityLevel);
    if (!Number.isFinite(priorityLevel)) {
      throw new Error('priorityLevel must be a number');
    }
    data.priorityLevel = priorityLevel;
  }
  if (body.commissionSplit !== undefined) {
    const commissionSplit = Number(body.commissionSplit);
    if (!Number.isFinite(commissionSplit) || commissionSplit < 0 || commissionSplit > 100) {
      throw new Error('commissionSplit must be between 0 and 100');
    }
    data.commissionSplit = commissionSplit;
  }

  const booleanFields = [
    'canTakeHouseSits',
    'canTakeTwentyFourHourCare',
    'isDefault',
    'canJoinPools',
    'canAutoAssign',
    'canOvernight',
    'canSameDay',
    'canHighValue',
    'canRecurring',
    'canLeadPool',
    'canOverrideDecline',
  ];
  for (const key of booleanFields) {
    if (body[key] !== undefined) {
      data[key] = parseBoolean(body[key]);
    }
  }

  if (body.benefits !== undefined) {
    data.benefits =
      typeof body.benefits === 'string' ? body.benefits : body.benefits ? JSON.stringify(body.benefits) : null;
  }
  if (body.badgeColor !== undefined) data.badgeColor = body.badgeColor ? String(body.badgeColor) : null;
  if (body.badgeStyle !== undefined) data.badgeStyle = body.badgeStyle ? String(body.badgeStyle) : null;
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.progressionRequirements !== undefined) {
    data.progressionRequirements =
      typeof body.progressionRequirements === 'string'
        ? body.progressionRequirements
        : body.progressionRequirements
          ? JSON.stringify(body.progressionRequirements)
          : null;
  }

  return data;
}

async function getOwnerCtx() {
  const ctx = await getRequestContext();
  requireAnyRole(ctx, ['owner', 'admin']);
  return ctx;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const { id } = await params;
    const tier = await (db as any).sitterTier.findFirst({
      where: { id },
    });
    if (!tier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }
    return NextResponse.json({ tier }, { status: 200 });
  } catch (error: any) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (String(error?.message || '').includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch tier', message: error?.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data = parseBody(body);

    const existing = await (db as any).sitterTier.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }

    if (data.isDefault === true) {
      await (db as any).sitterTier.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const tier = await (db as any).sitterTier.update({
      where: { id },
      data,
    });

    return NextResponse.json({ tier }, { status: 200 });
  } catch (error: any) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (String(error?.message || '').includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (String(error?.message || '').includes('cannot') || String(error?.message || '').includes('must')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Tier name must be unique within your organization' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update tier', message: error?.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const { id } = await params;
    const tier = await (db as any).sitterTier.findFirst({
      where: { id },
      select: { id: true, isDefault: true, _count: { select: { sitters: true, Sitter: true } } },
    });
    if (!tier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }
    if (tier.isDefault) {
      return NextResponse.json({ error: 'Default tier cannot be deleted' }, { status: 400 });
    }
    if ((tier._count?.Sitter ?? 0) > 0 || (tier._count?.sitters ?? 0) > 0) {
      return NextResponse.json({ error: 'Tier is still assigned to sitters' }, { status: 400 });
    }

    await (db as any).sitterTier.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (String(error?.message || '').includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete tier', message: error?.message }, { status: 500 });
  }
}
