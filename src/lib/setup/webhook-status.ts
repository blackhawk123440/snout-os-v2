/**
 * Shared webhook status logic for install, status, and readiness.
 * Single source of truth so endpoints cannot diverge.
 * We use Twilio IncomingPhoneNumbers (per-number smsUrl), not Messaging Service.
 */

import { getProviderCredentials, getTwilioClientFromCredentials } from '@/lib/messaging/provider-credentials';
import type { ProviderCredentials } from '@/lib/messaging/provider-credentials';
import { getTwilioWebhookUrl, webhookUrlMatches } from './webhook-url';

export interface WebhookNumberInfo {
  phoneNumberSid: string;
  e164: string;
  smsUrl: string | null;
  verified: boolean;
}

export interface WebhookStatusResult {
  webhookUrlExpected: string;
  matchedNumbers: WebhookNumberInfo[];
  unmatchedNumbers: WebhookNumberInfo[];
  installed: boolean;
  /** Total count from Twilio IncomingPhoneNumbers.list() */
  numbersFetchedCount: number;
}

/**
 * Fetch Twilio incoming numbers and split by whether smsUrl matches expected.
 * Used by GET webhooks/status and by GET readiness (webhooks check).
 */
export async function getWebhookStatus(
  credentials: ProviderCredentials
): Promise<WebhookStatusResult> {
  const webhookUrlExpected = getTwilioWebhookUrl();
  const client = getTwilioClientFromCredentials(credentials);
  const list = await client.incomingPhoneNumbers.list({ limit: 100 });

  const matchedNumbers: WebhookNumberInfo[] = [];
  const unmatchedNumbers: WebhookNumberInfo[] = [];

  for (const n of list) {
    const e164 = n.phoneNumber || '';
    const sid = n.sid || '';
    const smsUrl = n.smsUrl ?? null;
    const verified = webhookUrlMatches(smsUrl);
    const info: WebhookNumberInfo = { phoneNumberSid: sid, e164, smsUrl, verified };
    if (verified) matchedNumbers.push(info);
    else unmatchedNumbers.push(info);
  }

  return {
    webhookUrlExpected,
    matchedNumbers,
    unmatchedNumbers,
    installed: matchedNumbers.length > 0,
    numbersFetchedCount: list.length,
  };
}

/**
 * Get webhook status for an org (resolves credentials then calls getWebhookStatus).
 * Used by readiness to share the same logic as status.
 */
export async function getWebhookStatusForOrg(
  orgId: string
): Promise<WebhookStatusResult | null> {
  const credentials = await getProviderCredentials(orgId);
  if (!credentials) return null;
  return getWebhookStatus(credentials);
}
