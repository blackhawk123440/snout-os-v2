import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';

const TRAINING_KEY_PREFIX = 'sitter_training:';

const ALL_MODULES = [
  'company_policies',
  'safety_procedures',
  'gps_checkin',
  'visit_reports',
  'emergency_protocol',
  'payment_tips',
  'medication_admin',
  'client_communication',
];

/**
 * GET /api/sitters/[id]/training
 * Returns training completion for a specific sitter. Owner/admin only.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sitterId } = await params;

  try {
    const db = getScopedDb(ctx);
    const key = `${TRAINING_KEY_PREFIX}${sitterId}`;
    const row = await (db as any).setting.findFirst({ where: { key } });

    let completed: Record<string, boolean> = {};
    if (row?.value) {
      try { completed = JSON.parse(row.value); } catch {}
    }

    const completedCount = ALL_MODULES.filter((m) => completed[m]).length;

    return NextResponse.json({
      sitterId,
      completed,
      completedCount,
      totalModules: ALL_MODULES.length,
      percentComplete: Math.round((completedCount / ALL_MODULES.length) * 100),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load training', message: msg }, { status: 500 });
  }
}
