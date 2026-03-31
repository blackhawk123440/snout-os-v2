/**
 * Install Webhooks Route
 *
 * POST /api/setup/webhooks/install
 * Configures webhooks on Twilio IncomingPhoneNumbers (per-number smsUrl), not Messaging Service.
 * Returns updatedNumbers[], numbersFetchedCount, numbersUpdatedCount, accountSidMasked, firstTwilioError.
 * 409 when numbersFetchedCount === 0 (no Twilio numbers for this account).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getScopedDb } from '@/lib/tenancy';
import { logEvent } from '@/lib/log-event';
import { getProviderCredentials, getTwilioClientFromCredentials } from '@/lib/messaging/provider-credentials';
import { getTwilioWebhookUrl, webhookUrlMatches } from '@/lib/setup/webhook-url';
import { upsertCanonicalMessageNumbersFromTwilio } from '@/lib/messaging/sync-inventory';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized', url: null },
      { status: 401 }
    );
  }

  const user = session.user as any;
  const orgId = user.orgId || 'default';
  const db = getScopedDb({ orgId });

  const checkedAt = new Date().toISOString();
  try {
    const credentials = await getProviderCredentials(orgId);

    if (!credentials) {
      const hasRow = await prisma.providerCredential.findUnique({ where: { orgId }, select: { id: true } }).catch(() => null);
      const message = hasRow
        ? 'Credentials could not be read. Save your Account SID and Auth Token again in Connect Provider, then try Install Webhooks.'
        : 'No credentials found. Connect provider first.';
      return NextResponse.json({
        success: false,
        message,
        webhookTarget: 'incoming_phone_numbers',
        numbersFetchedCount: 0,
        numbersUpdatedCount: 0,
        accountSidMasked: null,
        firstTwilioError: null,
        url: null,
        verified: false,
        webhookUrlConfigured: false,
        orgId,
        checkedAt,
        updatedNumbers: [],
      }, { status: 400 });
    }

    const newSmsUrl = getTwilioWebhookUrl();
    const client = getTwilioClientFromCredentials(credentials);
    const accountSidMasked = credentials.accountSid
      ? `${credentials.accountSid.substring(0, 4)}...${credentials.accountSid.substring(credentials.accountSid.length - 4)}`
      : null;

    let incomingNumbers: { sid: string; phoneNumber?: string; smsUrl?: string | null }[];
    try {
      incomingNumbers = await client.incomingPhoneNumbers.list({ limit: 100 });
    } catch (twilioErr: any) {
      const isAuthError =
        twilioErr?.code === 20003 ||
        /authenticat/i.test(twilioErr?.message || '') ||
        twilioErr?.status === 401;
      const message = isAuthError
        ? 'Twilio rejected the credentials. Save your Account SID and Auth Token again in Connect Provider, then click Install Webhooks right after.'
        : twilioErr?.message || 'Failed to list Twilio numbers';
      console.error('[Webhook Install] Twilio error:', twilioErr?.code, twilioErr?.message, 'source:', credentials.source, 'orgId:', orgId);
      return NextResponse.json({
        success: false,
        message,
        credentialSource: credentials.source,
        webhookTarget: 'incoming_phone_numbers',
        numbersFetchedCount: 0,
        numbersUpdatedCount: 0,
        accountSidMasked,
        firstTwilioError: twilioErr?.message ?? null,
        url: null,
        verified: false,
        webhookUrlConfigured: false,
        orgId,
        checkedAt,
        updatedNumbers: [],
      }, { status: isAuthError ? 400 : 500 });
    }

    const numbersFetchedCount = incomingNumbers.length;

    if (numbersFetchedCount === 0) {
      return NextResponse.json({
        success: false,
        message: 'No Twilio numbers found for this account',
        webhookTarget: 'incoming_phone_numbers',
        numbersFetchedCount: 0,
        numbersUpdatedCount: 0,
        accountSidMasked,
        firstTwilioError: null,
        url: null,
        verified: false,
        orgId,
        checkedAt,
        updatedNumbers: [],
      }, { status: 409 });
    }

    const beforeMap = new Map<string, string | null>();
    for (const n of incomingNumbers) beforeMap.set(n.sid, n.smsUrl ?? null);

    const errors: string[] = [];
    let numbersUpdatedCount = 0;
    for (const number of incomingNumbers) {
      try {
        const statusCallbackUrl = newSmsUrl; // Same endpoint handles status callbacks
        await client.incomingPhoneNumbers(number.sid).update({
          smsUrl: newSmsUrl,
          smsMethod: 'POST',
          statusCallback: statusCallbackUrl,
          statusCallbackMethod: 'POST',
        });
        numbersUpdatedCount++;
      } catch (error: any) {
        const msg = `${number.phoneNumber}: ${error?.message || 'Unknown error'}`;
        console.error('[Webhook Install]', msg);
        errors.push(msg);
      }
    }

    // Re-fetch and build updatedNumbers with per-number verified (same normalization as status)
    const after = await client.incomingPhoneNumbers.list({ limit: 100 });
    const updatedNumbers: Array<{
      phoneNumberSid: string;
      e164: string;
      oldSmsUrl: string | null;
      newSmsUrl: string;
      verified: boolean;
    }> = [];
    for (const n of after) {
      const oldSmsUrl = beforeMap.get(n.sid) ?? null;
      const verified = webhookUrlMatches(n.smsUrl);
      updatedNumbers.push({
        phoneNumberSid: n.sid,
        e164: n.phoneNumber || '',
        oldSmsUrl,
        newSmsUrl,
        verified,
      });
    }
    const verified = updatedNumbers.some((u) => u.verified);
    const configuredCount = updatedNumbers.length;
    const firstTwilioError = errors[0] ?? null;

    // Sync Twilio numbers into MessageNumber so Test SMS and send pipeline have numbers
    try {
      await upsertCanonicalMessageNumbersFromTwilio(
        db as any,
        orgId,
        updatedNumbers.map((u) => ({ sid: u.phoneNumberSid, phoneNumber: u.e164 }))
      );
    } catch (syncErr: any) {
      console.error('[Webhook Install] Sync numbers to MessageNumber failed:', syncErr?.message);
      // Don't fail the request - webhooks are installed; user can retry or sync later
    }

    await logEvent({
      orgId,
      action: errors.length === 0 ? 'provisioning.twilio.webhooks_installed' : 'provisioning.twilio.webhooks_partial',
      status: errors.length === 0 ? 'success' : 'failed',
      metadata: { numbersUpdated: numbersUpdatedCount, errors: errors.slice(0, 3), url: newSmsUrl },
    }).catch(() => {});

    return NextResponse.json({
      success: errors.length === 0,
      message: verified
        ? `Webhooks installed and verified on ${configuredCount} number(s)`
        : errors.length
          ? `Configured ${configuredCount} number(s) but some failed; verification ${verified ? 'passed' : 'failed'}`
          : `Configured ${configuredCount} number(s); verification ${verified ? 'passed' : 'failed'}`,
      webhookTarget: 'incoming_phone_numbers',
      numbersFetchedCount,
      numbersUpdatedCount,
      accountSidMasked,
      firstTwilioError,
      url: newSmsUrl,
      verified,
      webhookUrlConfigured: verified,
      orgId,
      checkedAt,
      updatedNumbers,
      webhookUrlExpected: newSmsUrl,
      details: errors.length ? { configuredCount, errors } : undefined,
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Direct Twilio] Error installing webhooks:', error);
    const isAuthError =
      error?.code === 20003 ||
      /authenticat/i.test(error?.message || '') ||
      error?.status === 401;
    const message = isAuthError
      ? 'Twilio rejected the credentials. Check Account SID and Auth Token in Connect Provider, then try again.'
      : error?.message || 'Failed to install webhooks';
    return NextResponse.json({
      success: false,
      message,
      webhookTarget: 'incoming_phone_numbers',
      numbersFetchedCount: 0,
      numbersUpdatedCount: 0,
      accountSidMasked: null,
      firstTwilioError: error?.message ?? null,
      url: null,
      verified: false,
      webhookUrlConfigured: false,
      orgId,
      checkedAt: new Date().toISOString(),
      updatedNumbers: [],
    }, { status: isAuthError ? 400 : 500 });
  }
}
