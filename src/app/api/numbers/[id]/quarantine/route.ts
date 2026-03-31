import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }

  const params = await context.params;
  const db = getScopedDb({ orgId: ctx.orgId });

  // Read request body - support configurable duration
  let body: { 
    reason: string; 
    reasonDetail?: string; 
    durationDays?: number; 
    customReleaseDate?: string;
    duration?: '1' | '3' | '7' | '14' | '30' | '90' | 'custom';
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Map duration selector to days if provided
  let durationDays = body.durationDays;
  if (!durationDays && body.duration) {
    const durationMap: Record<string, number> = {
      '1': 1,
      '3': 3,
      '7': 7,
      '14': 14,
      '30': 30,
      '90': 90,
    };
    durationDays = durationMap[body.duration] || 90; // Default to 90 if invalid
  }
  if (!durationDays && !body.customReleaseDate) {
    durationDays = 90; // Safe default
  }

  try {
    await db.messageNumber.update({
      where: { id: params.id },
      data: { status: 'quarantined' },
    });
    const affectedThreads = await db.messageThread.count({
      where: { orgId: ctx.orgId, messageNumberId: params.id, status: 'open' },
    });
    const releaseAt = body.customReleaseDate
      ? new Date(body.customReleaseDate).toISOString()
      : new Date(Date.now() + (durationDays ?? 90) * 24 * 60 * 60 * 1000).toISOString();
    return NextResponse.json({
      success: true,
      impact: {
        affectedThreads,
        cooldownDays: durationDays ?? 90,
        releaseAt,
        message: `Number quarantined. ${affectedThreads} active thread(s) will be routed to owner inbox.`,
      },
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to quarantine number' }, { status: 500 });
  }
}
