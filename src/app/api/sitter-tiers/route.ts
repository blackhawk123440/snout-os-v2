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
  const name = String(body?.name || '').trim();
  const pointTarget = Number(body?.pointTarget);
  const minCompletionRate = parseOptionalNumber(body?.minCompletionRate);
  const minResponseRate = parseOptionalNumber(body?.minResponseRate);
  const priorityLevel = Number.isFinite(Number(body?.priorityLevel)) ? Number(body.priorityLevel) : 0;
  const benefits =
    typeof body?.benefits === 'string'
      ? body.benefits
      : body?.benefits
        ? JSON.stringify(body.benefits)
        : null;

  if (!name) {
    throw new Error('name is required');
  }
  if (!Number.isFinite(pointTarget) || pointTarget < 0) {
    throw new Error('pointTarget must be a non-negative number');
  }
  if (minCompletionRate !== null && (minCompletionRate < 0 || minCompletionRate > 100)) {
    throw new Error('minCompletionRate must be between 0 and 100');
  }
  if (minResponseRate !== null && (minResponseRate < 0 || minResponseRate > 100)) {
    throw new Error('minResponseRate must be between 0 and 100');
  }

  return {
    name,
    pointTarget,
    minCompletionRate,
    minResponseRate,
    priorityLevel,
    benefits,
    canTakeHouseSits: parseBoolean(body?.canTakeHouseSits),
    canTakeTwentyFourHourCare: parseBoolean(body?.canTakeTwentyFourHourCare),
    isDefault: parseBoolean(body?.isDefault),
    canJoinPools: parseBoolean(body?.canJoinPools),
    canAutoAssign: parseBoolean(body?.canAutoAssign),
    canOvernight: parseBoolean(body?.canOvernight),
    canSameDay: parseBoolean(body?.canSameDay),
    canHighValue: parseBoolean(body?.canHighValue),
    canRecurring: parseBoolean(body?.canRecurring),
    canLeadPool: parseBoolean(body?.canLeadPool),
    canOverrideDecline: parseBoolean(body?.canOverrideDecline),
    commissionSplit: Number.isFinite(Number(body?.commissionSplit)) ? Number(body.commissionSplit) : 70,
    badgeColor: body?.badgeColor ? String(body.badgeColor) : null,
    badgeStyle: body?.badgeStyle ? String(body.badgeStyle) : null,
    description: body?.description ? String(body.description) : null,
    progressionRequirements: body?.progressionRequirements
      ? (typeof body.progressionRequirements === 'string'
          ? body.progressionRequirements
          : JSON.stringify(body.progressionRequirements))
      : null,
  };
}

async function getOwnerCtx() {
  const ctx = await getRequestContext();
  requireAnyRole(ctx, ['owner', 'admin']);
  return ctx;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const tiers = await (db as any).sitterTier.findMany({
      where: {},
      orderBy: [{ priorityLevel: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json(
      { tiers },
      { status: 200, headers: { 'X-Snout-Org-Resolved': '1' } }
    );
  } catch (error: any) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (String(error?.message || '').includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch tiers', message: error?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const body = await request.json().catch(() => ({}));
    const data = parseBody(body);

    if (data.isDefault) {
      await (db as any).sitterTier.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    const tier = await (db as any).sitterTier.create({
      data,
    });

    return NextResponse.json({ tier }, { status: 201 });
  } catch (error: any) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (String(error?.message || '').includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (String(error?.message || '').includes('required') || String(error?.message || '').includes('must')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Tier name must be unique within your organization' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create tier', message: error?.message }, { status: 500 });
  }
}
