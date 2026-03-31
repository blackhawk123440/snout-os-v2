/**
 * GET /api/ops/schema-check
 * Returns whether MessageThread has clientApprovedAt and sitterApprovedAt (for Blocker 2 runbook).
 * Owner-only. Read-only information_schema query.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = session.user as { role?: string };
  if (user.role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  try {
    const rows = await prisma.$queryRaw<{ column_name: string }[]>(
      Prisma.sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'MessageThread'
          AND column_name IN ('clientApprovedAt', 'sitterApprovedAt')
        ORDER BY column_name
      `
    );
    const names = new Set(rows.map((r) => r.column_name));
    return NextResponse.json({
      messageThread: {
        clientApprovedAt: names.has('clientApprovedAt'),
        sitterApprovedAt: names.has('sitterApprovedAt'),
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Schema check failed', message, checkedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
