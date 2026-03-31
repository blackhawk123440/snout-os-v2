/**
 * POST /api/setup/test-owner-sms
 * Sends a test SMS to the owner's personal phone to verify messaging works.
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getMessagingProvider } from '@/lib/messaging/provider-factory';
import { logEvent } from '@/lib/log-event';

export async function POST() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ownerPhone = process.env.OWNER_PERSONAL_PHONE || process.env.OWNER_PHONE;
  if (!ownerPhone) {
    return NextResponse.json({ error: 'No owner phone number configured. Set OWNER_PHONE in environment.' }, { status: 400 });
  }

  try {
    const provider = await getMessagingProvider(ctx.orgId);
    const providerName = provider.constructor.name;

    const result = await provider.sendMessage({
      to: ownerPhone,
      body: `✅ Snout OS messaging test — ${providerName} is working! Your notifications will arrive here.`,
    });

    await logEvent({
      orgId: ctx.orgId,
      action: 'provisioning.test_owner_sms',
      status: result.success ? 'success' : 'failed',
      metadata: {
        provider: providerName,
        phone: ownerPhone.slice(0, 6) + '...',
        messageSid: result.messageSid,
        errorMessage: result.errorMessage,
      },
    }).catch(() => {});

    if (result.success) {
      return NextResponse.json({
        success: true,
        provider: providerName,
        messageSid: result.messageSid,
        phone: ownerPhone,
      });
    }

    return NextResponse.json({
      success: false,
      provider: providerName,
      error: result.errorMessage || 'Send failed',
    }, { status: 422 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
