import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { requireRole, ForbiddenError } from '@/lib/rbac';

const TRAINING_KEY_PREFIX = 'sitter_training:';

/**
 * GET /api/sitter/training
 * Returns the current sitter's training completion state.
 */
export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });
  }

  try {
    const db = getScopedDb(ctx);
    const key = `${TRAINING_KEY_PREFIX}${ctx.sitterId}`;
    const row = await (db as any).setting.findFirst({ where: { key } });

    let completed: Record<string, boolean> = {};
    if (row?.value) {
      try { completed = JSON.parse(row.value); } catch {}
    }

    return NextResponse.json({ completed });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load training', message: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/sitter/training
 * Updates training completion state. Body: { moduleId: string, completed: boolean }
 */
export async function PATCH(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { moduleId, completed: isCompleted } = body;

    if (typeof moduleId !== 'string' || !moduleId.trim()) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 });
    }
    if (typeof isCompleted !== 'boolean') {
      return NextResponse.json({ error: 'completed must be a boolean' }, { status: 400 });
    }

    const db = getScopedDb(ctx);
    const key = `${TRAINING_KEY_PREFIX}${ctx.sitterId}`;

    // Load existing state
    const row = await (db as any).setting.findFirst({ where: { key } });
    let state: Record<string, boolean> = {};
    if (row?.value) {
      try { state = JSON.parse(row.value); } catch {}
    }

    // Update
    state[moduleId] = isCompleted;

    await (db as any).setting.upsert({
      where: { orgId_key: { orgId: ctx.orgId, key } },
      create: {
        orgId: ctx.orgId,
        key,
        value: JSON.stringify(state),
        category: 'training',
        label: `Training: ${ctx.sitterId}`,
      },
      update: {
        value: JSON.stringify(state),
      },
    });

    return NextResponse.json({ completed: state });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to update training', message: msg }, { status: 500 });
  }
}
