/**
 * Messaging Availability Check
 *
 * Determines whether an org can send SMS messages based on their
 * OrgIntegrationConfig.messagingProvider setting.
 *
 * When provider is "none", SMS is unavailable and notifications should
 * fall back to email + in-app only. This prevents silent failures
 * when an org hasn't configured a messaging provider.
 *
 * Usage in notification triggers:
 *   const canSms = await isMessagingAvailable(orgId);
 *   if (!canSms) {
 *     // skip SMS, send email / in-app instead
 *     return;
 *   }
 */

import { prisma } from '@/lib/db';

// Cache per orgId for the duration of a request (avoid repeated DB hits
// within a single notification fan-out that checks multiple times).
const requestCache = new Map<string, boolean>();

/**
 * Returns true if the org has a messaging provider configured (twilio or openphone).
 * Returns false if provider is "none" or the config row doesn't exist yet.
 *
 * Defaults to true when no config exists (backward-compatible: existing orgs
 * that predate this feature likely have Twilio/OpenPhone already set up).
 */
export async function isMessagingAvailable(orgId: string): Promise<boolean> {
  if (requestCache.has(orgId)) {
    return requestCache.get(orgId)!;
  }

  try {
    const config = await (prisma as any).orgIntegrationConfig.findFirst({
      where: { orgId },
      select: { messagingProvider: true, messagingConfigured: true },
    });

    // No config row yet → assume messaging is available (backward-compat)
    if (!config) {
      requestCache.set(orgId, true);
      return true;
    }

    const available = config.messagingProvider !== 'none';
    requestCache.set(orgId, available);
    return available;
  } catch (error) {
    // If the table doesn't exist yet (pre-migration), default to available
    console.error('[isMessagingAvailable] check failed, defaulting to true:', error);
    return true;
  }
}

/**
 * Returns the configured messaging provider for an org.
 * Used by the send path to know which provider adapter to use.
 */
export async function getMessagingProvider(
  orgId: string
): Promise<'none' | 'twilio' | 'openphone'> {
  try {
    const config = await (prisma as any).orgIntegrationConfig.findFirst({
      where: { orgId },
      select: { messagingProvider: true },
    });

    if (!config) return 'twilio'; // backward-compat default

    const provider = config.messagingProvider;
    if (provider === 'twilio' || provider === 'openphone' || provider === 'none') {
      return provider;
    }
    return 'twilio'; // fallback for unknown values
  } catch {
    return 'twilio';
  }
}

/**
 * Returns the fallback phone number for orgs using "none" provider.
 * This is the owner's personal number they want clients to text.
 */
export async function getMessagingFallbackPhone(
  orgId: string
): Promise<string | null> {
  try {
    const config = await (prisma as any).orgIntegrationConfig.findFirst({
      where: { orgId },
      select: { messagingFallbackPhone: true },
    });
    return config?.messagingFallbackPhone ?? null;
  } catch {
    return null;
  }
}

/**
 * Clear the request-scoped cache. Call at the start of a new request
 * if you're in a long-running process that handles multiple orgs.
 */
export function clearMessagingCache(): void {
  requestCache.clear();
}
