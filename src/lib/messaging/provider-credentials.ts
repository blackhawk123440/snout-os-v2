/**
 * Provider Credentials Helper
 * 
 * Resolves provider credentials from database (encrypted) with env fallback.
 * Used by TwilioProvider and other provider services.
 */

import { prisma } from "@/lib/db";
import { decrypt } from "./encryption";
import { env } from "@/lib/env";

export interface ProviderCredentials {
  accountSid: string;
  authToken: string;
  /** When set, use API Key auth: twilio(apiKeySid, apiKeySecret, accountSid) */
  apiKeySid?: string;
  apiKeySecret?: string;
  source: 'database' | 'environment';
}

/**
 * Get provider credentials for an organization
 * 
 * Priority:
 * 1. Database (encrypted) - production
 * 2. Environment variables - development fallback
 * 
 * @param orgId - Organization ID
 * @returns Provider credentials or null if not configured
 */
export async function getProviderCredentials(orgId: string): Promise<ProviderCredentials | null> {
  try {
    const credential = await prisma.providerCredential.findUnique({
      where: { orgId },
    });

  if (!credential) {
      return env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
        ? {
            accountSid: String(env.TWILIO_ACCOUNT_SID).trim(),
            authToken: String(env.TWILIO_AUTH_TOKEN).trim(),
            source: 'environment',
          }
        : null;
    }
    const decrypted = decrypt(credential.encryptedConfig);
    const config = JSON.parse(decrypted);
    const accountSid = String(config.accountSid ?? '').trim();
    const authToken = String(config.authToken ?? '').trim();
    const apiKeySid = config.apiKeySid != null ? String(config.apiKeySid).trim() : undefined;
    const apiKeySecret = config.apiKeySecret != null ? String(config.apiKeySecret).trim() : undefined;
    const useApiKey = !!(apiKeySid && apiKeySecret);
    if (!accountSid) {
      console.error('[provider-credentials] Stored credentials missing accountSid for orgId:', orgId);
      return null;
    }
    if (!useApiKey && !authToken) {
      console.error('[provider-credentials] Stored credentials missing authToken (and no API Key) for orgId:', orgId);
      return null;
    }
    return {
      accountSid,
      authToken: authToken || '',
      ...(useApiKey ? { apiKeySid, apiKeySecret } : {}),
      source: 'database' as const,
    };
  } catch (error) {
    console.error('[provider-credentials] Failed to load/decrypt credentials for orgId:', orgId, error);
    // When a DB row exists but decrypt/parse failed, do NOT fall back to env — that would
    // use different credentials than Connect saved and cause "Connected but Install fails".
    try {
      const row = await prisma.providerCredential.findUnique({ where: { orgId } });
      if (row) return null; // Force user to re-save so we re-encrypt with current key
    } catch (_) {
      return null; // DB error; don't use env to avoid wrong credentials
    }
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
      return {
        accountSid: String(env.TWILIO_ACCOUNT_SID).trim(),
        authToken: String(env.TWILIO_AUTH_TOKEN).trim(),
        source: 'environment',
      };
    }
    return null;
  }
}

/**
 * Create a Twilio client from credentials (Account SID + Auth Token, or API Key SID + Secret + Account SID).
 * Use this everywhere we need a Twilio client so API Key auth is supported.
 */
export function getTwilioClientFromCredentials(credentials: ProviderCredentials): any {
  const twilio = require('twilio'); // Dynamic require for Twilio (external package)
  const { accountSid, authToken, apiKeySid, apiKeySecret } = credentials;
  if (!accountSid) {
    throw new Error('Twilio accountSid is required');
  }
  if (apiKeySid && apiKeySecret) {
    return twilio(apiKeySid, apiKeySecret, accountSid);
  }
  if (!authToken) {
    throw new Error('Twilio authToken or API Key (apiKeySid + apiKeySecret) is required');
  }
  return twilio(accountSid, authToken);
}
