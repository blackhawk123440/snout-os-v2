/**
 * GET /api/ops/messaging-status
 * Returns messaging provisioning status for the dashboard indicator.
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getOrgMessagingProviderType } from '@/lib/messaging/provider-factory';
import { logEvent } from '@/lib/log-event';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const providerType = await getOrgMessagingProviderType(ctx.orgId);

    // Check if we have active numbers
    let hasActiveNumbers = false;
    let numberCount = 0;
    try {
      const { prisma } = await import('@/lib/db');
      const numbers = await (prisma as any).messageNumber.count({
        where: { orgId: ctx.orgId, status: 'active' },
      });
      hasActiveNumbers = numbers > 0;
      numberCount = numbers;
    } catch {}

    const active = providerType !== 'none' && (providerType === 'openphone' || hasActiveNumbers);

    return NextResponse.json({
      active,
      provider: providerType,
      hasActiveNumbers,
      numberCount,
      setupUrl: '/messaging/twilio-setup',
      message: active
        ? `Messaging active via ${providerType === 'openphone' ? 'OpenPhone' : 'Twilio'}`
        : 'Messaging not configured — set up now',
    });
  } catch (error) {
    await logEvent({
      orgId: ctx.orgId,
      action: 'messaging.status_check.failed',
      status: 'failed',
      metadata: { error: error instanceof Error ? error.message : 'Unknown' },
    });
    return NextResponse.json({ active: false, provider: 'none', message: 'Status check failed' });
  }
}
