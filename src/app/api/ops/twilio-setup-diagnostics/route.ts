/**
 * Twilio Setup Diagnostics
 *
 * GET /api/ops/twilio-setup-diagnostics
 * Returns safe diagnostics for the Twilio Setup tab (masked SID, webhook URLs; no secrets).
 * Owner-only. Available in all environments.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getProviderCredentials, getTwilioClientFromCredentials } from '@/lib/messaging/provider-credentials';
import { getTwilioWebhookUrl, webhookUrlMatches } from '@/lib/setup/webhook-url';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== 'owner' && !user.orgId) {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }

  const orgId = user.orgId || 'default';
  const out: {
    orgId: string;
    credentialsExist: boolean;
    credentialSource?: 'database' | 'environment';
    /** 'apiKey' when stored credentials use API Key SID+Secret; 'authToken' otherwise */
    authType?: 'apiKey' | 'authToken';
    accountSidUsed: string | null;
    webhookTarget: string;
    webhookUrlExpected: string;
    twilioConfiguredUrls: Array<{ phoneNumber: string; sid: string; smsUrl: string | null }>;
    errors: string[];
    hint?: string;
    checkedAt: string;
  } = {
    orgId,
    credentialsExist: false,
    accountSidUsed: null,
    webhookTarget: 'incoming_phone_numbers',
    webhookUrlExpected: getTwilioWebhookUrl(),
    twilioConfiguredUrls: [],
    errors: [],
    checkedAt: new Date().toISOString(),
  };

  try {
    const credentials = await getProviderCredentials(orgId);
    out.credentialsExist = !!credentials;
    out.credentialSource = credentials?.source;
    out.authType = credentials?.apiKeySid && credentials?.apiKeySecret ? 'apiKey' : 'authToken';
    out.accountSidUsed = credentials?.accountSid
      ? `${credentials.accountSid.substring(0, 4)}...${credentials.accountSid.substring(credentials.accountSid.length - 4)}`
      : null;

    if (!credentials) {
      out.errors.push('No credentials in DB for this org. Connect provider first.');
      return NextResponse.json(out, { status: 200 });
    }

    const client = getTwilioClientFromCredentials(credentials);
    const incomingNumbers = await client.incomingPhoneNumbers.list({ limit: 50 });
    for (const n of incomingNumbers) {
      out.twilioConfiguredUrls.push({
        phoneNumber: n.phoneNumber || '',
        sid: n.sid || '',
        smsUrl: n.smsUrl || null,
      });
    }

    const anyMatch = out.twilioConfiguredUrls.some((c) => webhookUrlMatches(c.smsUrl));
    if (!anyMatch && out.twilioConfiguredUrls.length > 0) {
      out.errors.push('No number has webhook URL matching expected. Run Install Webhooks.');
    } else if (out.twilioConfiguredUrls.length === 0) {
      out.errors.push('No incoming phone numbers in Twilio account.');
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    out.errors.push(msg);
    const isAuthError = err?.code === 20003 || /authenticat/i.test(msg) || err?.status === 401;
    if (isAuthError) {
      out.hint = 'Twilio rejected the stored Auth Token. In Twilio Console go to Account → API keys & tokens, copy the Auth Token (or create a new one), then in this app open Connect Provider, paste Account SID and the (new) Auth Token, Save, then Install Webhooks.';
    }
  }

  return NextResponse.json(out, { status: 200 });
}
