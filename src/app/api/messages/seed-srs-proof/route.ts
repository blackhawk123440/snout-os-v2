/**
 * Seed SRS Proof Endpoint (Owner Only)
 *
 * POST /api/messages/seed-srs-proof
 *
 * Runs the seed script and automatically triggers snapshot
 */

/**
 * Seed SRS Proof Endpoint (Owner Only)
 *
 * POST /api/messages/seed-srs-proof
 *
 * Runs the seed script and automatically triggers snapshot + weekly eval
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import { scheduleDailySnapshots, scheduleWeeklyEvaluations } from '@/lib/tiers/srs-queue';
import { getScopedDb } from '@/lib/tenancy';
import { resolveCorrelationId } from '@/lib/correlation-id';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Owner only
  const user = session.user as any;
  if (user.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Guardrail: Only in dev/staging
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_OPS_SRS) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const orgId = user.orgId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    const db = getScopedDb({ orgId });

    // Run seed script
    const { stdout, stderr } = await execAsync(
      'npx tsx scripts/seed-srs-proof.ts',
      { cwd: process.cwd() }
    );

    if (stderr && !stderr.includes('\u2713')) {
      console.error('[Seed SRS] Warnings:', stderr);
    }

    // Wait a moment for data to settle
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Trigger snapshot directly (not via HTTP)
    const asOfDate = new Date();
    const correlationId = resolveCorrelationId(request);
    await scheduleDailySnapshots(orgId, asOfDate, correlationId);

    // Wait for jobs to process
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Trigger weekly evaluation
    await scheduleWeeklyEvaluations(orgId, asOfDate, correlationId);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get created snapshots
    const snapshots = await (db as any).sitterTierSnapshot.findMany({
      where: {
        asOfDate: {
          gte: new Date(asOfDate.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(asOfDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      include: {
        sitter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      seedOutput: stdout,
      snapshotsCreated: snapshots.length,
      snapshots: snapshots.map((s: any) => ({
        sitterId: s.sitterId,
        sitterName: `${s.sitter.firstName} ${s.sitter.lastName}`,
        score: s.rolling30dScore,
        tier: s.tier,
        provisional: s.provisional,
        visits30d: s.visits30d,
        atRisk: s.atRisk,
      })),
    });
  } catch (error: any) {
    console.error('[Seed SRS Proof] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to seed proof data',
        message: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
      },
      { status: 500 }
    );
  }
}
