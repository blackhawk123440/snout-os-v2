/**
 * Single source of truth for Twilio webhook URL used by setup (install + status + readiness).
 * Ensures install and status check the same target.
 */

import { env } from '@/lib/env';

const WEBHOOK_PATH = '/api/messages/webhook/twilio';

/**
 * Full URL we configure in Twilio (no trailing slash).
 */
export function getTwilioWebhookUrl(): string {
  if (env.TWILIO_WEBHOOK_URL) return env.TWILIO_WEBHOOK_URL.replace(/\/+$/, '');
  const base = (env.WEBHOOK_BASE_URL || env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return base + WEBHOOK_PATH;
}

/**
 * Normalize a URL for comparison (trim trailing slash, lowercase path).
 * Twilio may return the same URL with/without trailing slash.
 */
export function webhookUrlMatches(configured: string | null | undefined): boolean {
  if (!configured || typeof configured !== 'string') return false;
  const normalized = configured.trim().replace(/\/+$/, '');
  const expected = getTwilioWebhookUrl().replace(/\/+$/, '');
  return normalized === expected || normalized.endsWith(WEBHOOK_PATH);
}
