/**
 * Seed Sitter Dashboard API Endpoint
 * 
 * POST /api/ops/seed-sitter-dashboard
 * Owner-only endpoint to seed sitter dashboard test data
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

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

  // Only in non-prod or with flag
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_OPS_SEED !== 'true') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    // Import and run seed script
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const { stdout, stderr } = await execAsync('tsx scripts/seed-sitter-dashboard.ts', {
      cwd: process.cwd(),
      env: process.env,
    });

    return NextResponse.json({
      success: true,
      message: 'Sitter dashboard data seeded successfully',
      output: stdout,
      errors: stderr || null,
    });
  } catch (error: any) {
    console.error('[Seed Sitter Dashboard] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to seed sitter dashboard data',
        message: error.message,
        output: error.stdout || null,
        errors: error.stderr || null,
      },
      { status: 500 }
    );
  }
}
