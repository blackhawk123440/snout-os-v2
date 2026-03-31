/**
 * Provider Factory
 *
 * Creates MessagingProvider instances.
 * Supports Twilio (masked numbers) and OpenPhone (real numbers).
 */

import type { MessagingProvider } from './provider';
import { getProviderCredentials, type ProviderCredentials } from './provider-credentials';
import { TwilioProvider } from './providers/twilio';
import { OpenPhoneProvider } from './providers/openphone';

/**
 * Mock provider when no real provider is configured.
 */
class MockProvider implements MessagingProvider {
  verifyWebhook(): boolean { return false; }
  parseInbound(): any { throw new Error('Not implemented'); }
  parseStatusCallback(): any { throw new Error('Not implemented'); }
  async sendMessage(): Promise<never> {
    throw new Error('No messaging provider configured. Connect OpenPhone or Twilio in /settings.');
  }
  async createSession(): Promise<any> { throw new Error('Not implemented'); }
  async createParticipant(): Promise<any> { throw new Error('Not implemented'); }
  async sendViaProxy(): Promise<any> { throw new Error('Not implemented'); }
  async updateSessionParticipants(): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'No messaging provider configured. Connect OpenPhone or Twilio in /settings.' };
  }
}

/**
 * Get a messaging provider instance for an organization.
 * Checks: DB MessageAccount → DB Twilio credentials → env OpenPhone → MockProvider.
 */
export async function getMessagingProvider(orgId: string): Promise<MessagingProvider> {
  // 0. Explicit provider override via env
  if (process.env.MESSAGING_PROVIDER === 'openphone') {
    const apiKey = process.env.OPENPHONE_API_KEY;
    const numberId = process.env.OPENPHONE_NUMBER_ID;
    if (apiKey && numberId) {
      return new OpenPhoneProvider(apiKey, numberId, process.env.OPENPHONE_WEBHOOK_SECRET);
    }
  }

  // 1. Check for DB-configured provider (MessageAccount)
  try {
    const { prisma } = await import('@/lib/db');
    const messageAccount = await (prisma as any).messageAccount.findFirst({
      where: { orgId },
      orderBy: { updatedAt: 'desc' },
    });

    if (messageAccount?.provider === 'openphone' && messageAccount.providerConfigJson) {
      try {
        const config = JSON.parse(messageAccount.providerConfigJson);
        if (config.apiKey && config.phoneNumberId) {
          return new OpenPhoneProvider(config.apiKey, config.phoneNumberId, config.webhookSecret);
        }
      } catch (e) {
        console.error('[provider-factory] Failed to parse OpenPhone config for org:', orgId, e);
      }
    }
  } catch {
    // MessageAccount table may not exist yet — continue to fallbacks
  }

  // 2. Check for Twilio credentials
  const credentials: ProviderCredentials | null = await getProviderCredentials(orgId);
  if (credentials) {
    return new TwilioProvider(undefined, orgId, credentials);
  }

  // 3. Check environment-level OpenPhone fallback
  const openphoneApiKey = process.env.OPENPHONE_API_KEY;
  const openphoneNumberId = process.env.OPENPHONE_NUMBER_ID;
  if (openphoneApiKey && openphoneNumberId) {
    return new OpenPhoneProvider(
      openphoneApiKey,
      openphoneNumberId,
      process.env.OPENPHONE_WEBHOOK_SECRET,
    );
  }

  return new MockProvider();
}

/**
 * Get the provider type for an org (used by UI to show provider-specific pages).
 */
export async function getOrgMessagingProviderType(orgId: string): Promise<'twilio' | 'openphone' | 'none'> {
  try {
    const { prisma } = await import('@/lib/db');
    const messageAccount = await (prisma as any).messageAccount.findFirst({
      where: { orgId },
      orderBy: { updatedAt: 'desc' },
    });
    if (messageAccount?.provider === 'openphone') return 'openphone';
  } catch {}

  const credentials = await getProviderCredentials(orgId);
  if (credentials) return 'twilio';

  if (process.env.OPENPHONE_API_KEY) return 'openphone';
  return 'none';
}
