/**
 * Household / Family Management API
 *
 * GET  /api/ops/households - Returns all households for the org
 * POST /api/ops/households - Creates a new household
 *
 * Households are stored as a JSON array in the Setting table
 * under the key "households".
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { randomUUID } from 'crypto';

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

export async function GET() {
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

  try {
    const db = getScopedDb(ctx);
    const households = await loadHouseholds(db);
    return NextResponse.json({ households });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load households', message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

  let body: {
    name?: string;
    primaryBillingClientId?: string;
    memberClientIds?: string[];
    sharedPetIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = body.name?.trim();
  const primaryBillingClientId = body.primaryBillingClientId?.trim();

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!primaryBillingClientId) {
    return NextResponse.json({ error: 'primaryBillingClientId is required' }, { status: 400 });
  }

  try {
    const db = getScopedDb(ctx);
    const households = await loadHouseholds(db);

    const household: Household = {
      id: randomUUID(),
      name,
      primaryBillingClientId,
      memberClientIds: Array.isArray(body.memberClientIds) ? body.memberClientIds : [primaryBillingClientId],
      sharedPetIds: Array.isArray(body.sharedPetIds) ? body.sharedPetIds : [],
      createdAt: new Date().toISOString(),
    };

    households.push(household);
    await saveHouseholds(db, ctx.orgId, households);

    return NextResponse.json({ household }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to create household', message }, { status: 500 });
  }
}
