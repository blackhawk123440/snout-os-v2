/**
 * Messaging guard — graceful degradation when SMS is not provisioned.
 * Automations call this before attempting to send.
 * If not provisioned: logs a warning, creates an EventLog entry, returns false.
 */

import { getOrgMessagingProviderType } from './messaging/provider-factory';
import { logEvent } from './log-event';

let cachedProviderType: string | null = null;
let cacheExpiry = 0;

/**
 * Check if messaging is ready for the org. Caches for 60s.
 */
export async function isMessagingReady(orgId: string): Promise<boolean> {
  if (cachedProviderType && Date.now() < cacheExpiry) {
    return cachedProviderType !== 'none';
  }

  try {
    const type = await getOrgMessagingProviderType(orgId);
    cachedProviderType = type;
    cacheExpiry = Date.now() + 60000;
    return type !== 'none';
  } catch {
    return false;
  }
}

/**
 * Guard wrapper for SMS-dependent automation functions.
 * If messaging isn't provisioned, logs a warning and returns false instead of failing silently.
 */
export async function guardedSend(
  orgId: string,
  automationType: string,
  sendFn: () => Promise<boolean>,
): Promise<boolean> {
  const ready = await isMessagingReady(orgId);

  if (!ready) {
    console.warn(`[messaging-guard] SMS not provisioned for org ${orgId} — ${automationType} queued but not sent`);
    await logEvent({
      orgId,
      action: 'automation.sms_not_provisioned',
      status: 'failed',
      metadata: {
        automationType,
        reason: 'No messaging provider configured. Set up Twilio or OpenPhone in /messaging.',
      },
    }).catch(() => {});
    return false;
  }

  return sendFn();
}
