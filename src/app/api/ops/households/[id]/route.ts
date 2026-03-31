/**
 * Individual Household Management API
 *
 * GET    /api/ops/households/[id] - Returns household by ID with member details
 * PATCH  /api/ops/households/[id] - Update household (add/remove members, change billing)
 * DELETE /api/ops/households/[id] - Delete household
 *
 * Households are stored as a JSON array in the Setting table
 * under the key "households".
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

const SETTING_KEY = 'households';

interface Household {
  id: string;
  name: string;
  primaryBillingClientId: string;
  memberClientIds: string[];
  sharedPetIds: string[];
  createdAt: string;
}

async function loadHouseholds(db: any): Promise<Household[]> {
  const setting = await db.setting.findFirst({
    where: { key: SETTING_KEY },
  });

  if (!setting?.value) return [];

  try {
    const parsed = JSON.parse(setting.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveHouseholds(db: any, orgId: string, households: Household[]): Promise<void> {
  await db.setting.upsert({
    where: { orgId_key: { orgId, key: SETTING_KEY } },
    create: {
      orgId,
      key: SETTING_KEY,
      value: JSON.stringify(households),
      category: 'households',
      label: 'Households',
    },
    update: {
      value: JSON.stringify(households),
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const db = getScopedDb(ctx);
    const households = await loadHouseholds(db);
    const household = households.find((h) => h.id === id);

    if (!household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    // Enrich with member and pet details
    const members = household.memberClientIds.length
      ? await db.client.findMany({
          where: { id: { in: household.memberClientIds } },
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        })
      : [];

    const pets = household.sharedPetIds.length
      ? await db.pet.findMany({
          where: { id: { in: household.sharedPetIds } },
          select: { id: true, name: true, breed: true, species: true },
        })
      : [];

    return NextResponse.json({
      household: {
        ...household,
        members,
        pets,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load household', message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: {
    name?: string;
    primaryBillingClientId?: string;
    addMemberClientIds?: string[];
    removeMemberClientIds?: string[];
    memberClientIds?: string[];
    addSharedPetIds?: string[];
    removeSharedPetIds?: string[];
    sharedPetIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const db = getScopedDb(ctx);
    const households = await loadHouseholds(db);
    const index = households.findIndex((h) => h.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    const household = { ...households[index] };

    // Update name
    if (body.name !== undefined) {
      const trimmed = body.name.trim();
      if (!trimmed) {
        return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
      }
      household.name = trimmed;
    }

    // Update primary billing client
    if (body.primaryBillingClientId !== undefined) {
      household.primaryBillingClientId = body.primaryBillingClientId;
    }

    // Update member client IDs: full replace or add/remove
    if (Array.isArray(body.memberClientIds)) {
      household.memberClientIds = body.memberClientIds;
    } else {
      if (Array.isArray(body.addMemberClientIds)) {
        const existing = new Set(household.memberClientIds);
        body.addMemberClientIds.forEach((cid) => existing.add(cid));
        household.memberClientIds = Array.from(existing);
      }
      if (Array.isArray(body.removeMemberClientIds)) {
        const toRemove = new Set(body.removeMemberClientIds);
        household.memberClientIds = household.memberClientIds.filter((cid) => !toRemove.has(cid));
      }
    }

    // Update shared pet IDs: full replace or add/remove
    if (Array.isArray(body.sharedPetIds)) {
      household.sharedPetIds = body.sharedPetIds;
    } else {
      if (Array.isArray(body.addSharedPetIds)) {
        const existing = new Set(household.sharedPetIds);
        body.addSharedPetIds.forEach((pid) => existing.add(pid));
        household.sharedPetIds = Array.from(existing);
      }
      if (Array.isArray(body.removeSharedPetIds)) {
        const toRemove = new Set(body.removeSharedPetIds);
        household.sharedPetIds = household.sharedPetIds.filter((pid) => !toRemove.has(pid));
      }
    }

    households[index] = household;
    await saveHouseholds(db, ctx.orgId, households);

    return NextResponse.json({ household });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to update household', message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const db = getScopedDb(ctx);
    const households = await loadHouseholds(db);
    const index = households.findIndex((h) => h.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    households.splice(index, 1);
    await saveHouseholds(db, ctx.orgId, households);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to delete household', message }, { status: 500 });
  }
}
