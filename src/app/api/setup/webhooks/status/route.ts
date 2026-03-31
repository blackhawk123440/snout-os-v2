/**
 * Webhook Status Route
 * 
 * GET /api/setup/webhooks/status
 * Uses shared getWebhookStatus() (Twilio IncomingPhoneNumbers, not Messaging Service).
 * Returns matchedNumbers[], unmatchedNumbers[], numbersFetchedCount, accountSidMasked, firstTwilioError.
 * 409 when numbersFetchedCount === 0 (no Twilio numbers for this account).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getProviderCredentials } from '@/lib/messaging/provider-credentials';
import { getWebhookStatus } from '@/lib/setup/webhook-status';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { installed: false, url: null, lastReceivedAt: null, status: 'not_installed', numbersFetchedCount: 0, accountSidMasked: null, firstTwilioError: null, webhookTarget: 'incoming_phone_numbers' },
      { status: 401 }
    );
  }

  const user = session.user as any;
  const orgId = user.orgId || 'default';

  const checkedAt = new Date().toISOString();
  try {
    const credentials = await getProviderCredentials(orgId);

    if (!credentials) {
      return NextResponse.json({
        installed: false,
        url: null,
        lastReceivedAt: null,
        status: 'not_configured',
        checkedAt,
        verified: false,
        webhookTarget: 'incoming_phone_numbers',
        numbersFetchedCount: 0,
        accountSidMasked: null,
        firstTwilioError: null,
        matchedNumbers: [],
        unmatchedNumbers: [],
        webhookUrlExpected: null,
      }, { status: 200 });
    }

    const accountSidMasked = credentials.accountSid
      ? `${credentials.accountSid.substring(0, 4)}...${credentials.accountSid.substring(credentials.accountSid.length - 4)}`
      : null;

    const result = await getWebhookStatus(credentials);

    if (result.numbersFetchedCount === 0) {
      return NextResponse.json({
        installed: false,
        url: null,
        lastReceivedAt: null,
        status: 'no_numbers',
        checkedAt,
        verified: false,
        webhookTarget: 'incoming_phone_numbers',
        numbersFetchedCount: 0,
        accountSidMasked,
        firstTwilioError: null,
        message: 'No Twilio numbers found for this account',
        matchedNumbers: [],
        unmatchedNumbers: [],
        webhookUrlExpected: result.webhookUrlExpected,
      }, { status: 409 });
    }

    const configuredUrl = result.matchedNumbers[0]?.smsUrl ?? (result.installed ? result.webhookUrlExpected : null);

    return NextResponse.json({
      installed: result.installed,
      url: configuredUrl,
      lastReceivedAt: null,
      status: result.installed ? 'installed' : 'not_installed',
      checkedAt,
      verified: result.installed,
      webhookTarget: 'incoming_phone_numbers',
      numbersFetchedCount: result.numbersFetchedCount,
      accountSidMasked,
      firstTwilioError: null,
      webhookUrlExpected: result.webhookUrlExpected,
      matchedNumbers: result.matchedNumbers,
      unmatchedNumbers: result.unmatchedNumbers,
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Direct Twilio] Error checking webhook status:', error);
    const firstTwilioError = error?.message ?? null;
    return NextResponse.json({
      installed: false,
      url: null,
      lastReceivedAt: null,
      status: 'error',
      checkedAt,
      verified: false,
      errorDetail: error?.message || 'Failed to check Twilio webhook configuration',
      webhookTarget: 'incoming_phone_numbers',
      numbersFetchedCount: 0,
      accountSidMasked: null,
      firstTwilioError,
      matchedNumbers: [],
      unmatchedNumbers: [],
      webhookUrlExpected: null,
    }, { status: 200 });
  }
}
