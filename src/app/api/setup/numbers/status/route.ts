import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';

/**
 * GET /api/setup/numbers/status
 * Returns phone number inventory grouped by class (front_desk, sitter, pool).
 * Used by the setup wizard to show number readiness.
 */
export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    const numbers = await db.messageNumber.findMany({
      where: { status: 'active' },
      select: { id: true, e164: true, numberClass: true },
      orderBy: { e164: 'asc' },
    });

    const frontDesk = numbers.filter((n: any) => n.numberClass === 'front_desk');
    const sitter = numbers.filter((n: any) => n.numberClass === 'sitter');
    const pool = numbers.filter((n: any) => n.numberClass === 'pool');

    return NextResponse.json({
      hasFrontDesk: frontDesk.length > 0,
      frontDesk: {
        count: frontDesk.length,
        numbers: frontDesk.map((n: any) => ({ id: n.id, e164: n.e164 })),
      },
      sitter: {
        count: sitter.length,
        numbers: sitter.map((n: any) => ({ id: n.id, e164: n.e164 })),
      },
      pool: {
        count: pool.length,
        numbers: pool.map((n: any) => ({ id: n.id, e164: n.e164 })),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load numbers status', message }, { status: 500 });
  }
}
