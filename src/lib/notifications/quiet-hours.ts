/**
 * Quiet Hours Check
 *
 * Checks if a sitter is in their quiet hours window.
 * During quiet hours, push notifications are suppressed.
 * Messages still arrive and are stored — just the push is held.
 */

import { prisma } from '@/lib/db';

/**
 * Check if the current time is within the sitter's quiet hours.
 * Handles midnight crossing (e.g., 22:00 - 07:00).
 */
export function isInQuietHours(
  startTime: string,
  endTime: string,
  timezone: string
): boolean {
  try {
    const now = new Date();
    // Get current time in sitter's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const currentMinutes = h * 60 + m;

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      // Same day: e.g., 13:00 - 14:00
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Crosses midnight: e.g., 22:00 - 07:00
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  } catch {
    return false;
  }
}

/**
 * Check if a sitter should receive push notifications right now.
 * Returns true if push should be sent, false if in quiet hours.
 */
export async function shouldSendPushToSitter(sitterId: string): Promise<boolean> {
  try {
    const quietHours = await (prisma as any).sitterQuietHours.findUnique({
      where: { sitterId },
    });

    if (!quietHours?.enabled) return true;

    // Get sitter timezone
    const sitter = await (prisma as any).sitter.findUnique({
      where: { id: sitterId },
      select: { timezone: true },
    });
    const timezone = sitter?.timezone || 'America/Chicago';

    return !isInQuietHours(quietHours.startTime, quietHours.endTime, timezone);
  } catch {
    return true; // Fail open — send the notification
  }
}
