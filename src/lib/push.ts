/**
 * Web Push notification sender.
 *
 * Requires environment variables:
 * - VAPID_PUBLIC_KEY  — generated via web-push generate-vapid-keys
 * - VAPID_PRIVATE_KEY
 * - VAPID_SUBJECT     — mailto: or https:// URL (defaults to mailto:noreply@snoutservices.com)
 */

import webpush from 'web-push';
import { prisma } from '@/lib/db';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@snoutservices.com';

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[Push] VAPID keys not configured — push notifications disabled');
    return false;
  }
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
    return true;
  } catch (error) {
    console.error('[Push] Failed to set VAPID details:', error);
    return false;
  }
}

export type PushCategory = 'messages' | 'visitStarted' | 'reports' | 'assignments' | 'callouts';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;        // Deep-link URL when notification is clicked
  tag?: string;        // Collapse key — notifications with same tag replace each other
  icon?: string;
  badge?: string;
  category?: PushCategory; // Used to check user preferences
  data?: Record<string, unknown>;
}

const CATEGORY_TO_PREF: Record<PushCategory, string> = {
  messages: 'pushMessages',
  visitStarted: 'pushVisitStarted',
  reports: 'pushReports',
  assignments: 'pushAssignments',
  callouts: 'pushCallouts',
};

/**
 * Check if user has push enabled for a given category.
 * Returns true if no preferences record exists (default on).
 */
async function isUserPushEnabled(userId: string, category?: PushCategory): Promise<boolean> {
  try {
    const prefs = await prisma.userNotificationPreferences.findUnique({
      where: { userId },
    });
    if (!prefs) return true; // Default: all enabled
    if (!prefs.pushEnabled) return false; // Master toggle off
    if (category) {
      const prefKey = CATEGORY_TO_PREF[category];
      if (prefKey && prefKey in prefs) {
        return (prefs as any)[prefKey] !== false;
      }
    }
    return true;
  } catch {
    return true; // Fail open
  }
}

/**
 * Send push notification to a specific user (all their subscriptions).
 * Silently removes stale subscriptions (410 Gone).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!ensureVapid()) return { sent: 0, failed: 0 };

  // Check user preferences
  const enabled = await isUserPushEnabled(userId, payload.category);
  if (!enabled) return { sent: 0, failed: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    tag: payload.tag,
    icon: payload.icon ?? '/icon-192.png',
    badge: payload.badge ?? '/icon-192.png',
    data: payload.data,
  });

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 } // 1 hour
        );
        sent++;
      } catch (error: any) {
        // 410 Gone or 404 = subscription expired, remove it
        if (error?.statusCode === 410 || error?.statusCode === 404) {
          staleIds.push(sub.id);
        }
        failed++;
      }
    })
  );

  // Clean up stale subscriptions
  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: staleIds } },
    }).catch(() => {});
  }

  return { sent, failed };
}

/**
 * Send push notification to all subscriptions for a list of user IDs.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.allSettled(
    userIds.map((userId) => sendPushToUser(userId, payload))
  );
}

/**
 * Send push to a user by their role-specific ID (sitterId or clientId).
 * Looks up the User record first.
 */
export async function sendPushToSitter(sitterId: string, payload: PushPayload): Promise<void> {
  // Check quiet hours before sending push
  try {
    const { shouldSendPushToSitter } = await import('@/lib/notifications/quiet-hours');
    const shouldSend = await shouldSendPushToSitter(sitterId);
    if (!shouldSend) return;
  } catch { /* fail-open: send the notification */ }

  const user = await prisma.user.findFirst({
    where: { sitterId, deletedAt: null },
    select: { id: true },
  });
  if (user) await sendPushToUser(user.id, payload);
}

export async function sendPushToClient(clientId: string, payload: PushPayload): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { clientId, deletedAt: null },
    select: { id: true },
  });
  if (user) await sendPushToUser(user.id, payload);
}

/**
 * Send push to all owners/admins in an org.
 */
export async function sendPushToOwners(orgId: string, payload: PushPayload): Promise<void> {
  const owners = await prisma.user.findMany({
    where: { orgId, role: { in: ['owner', 'admin'] }, deletedAt: null },
    select: { id: true },
  });
  await sendPushToUsers(owners.map((o) => o.id), payload);
}
