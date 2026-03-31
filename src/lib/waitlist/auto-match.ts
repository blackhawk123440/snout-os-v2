/**
 * Waitlist auto-matching — checks if a cancelled booking matches
 * any waiting entries and notifies matched clients via SMS.
 */

import { prisma } from '@/lib/db';
import { guardedSend } from '@/lib/messaging-guard';
import { sendMessage } from '@/lib/message-utils';

const WAITLIST_KEY = 'waitlist_entries';

interface WaitlistEntry {
  id: string;
  orgId: string;
  clientId: string;
  clientName: string;
  service: string;
  preferredDate: string;
  preferredTimeStart: string;
  preferredTimeEnd: string;
  notes: string;
  status: 'waiting' | 'notified' | 'booked' | 'expired';
  createdAt: string;
}

interface CancelledBooking {
  id: string;
  service: string;
  startAt: Date | string;
  endAt: Date | string;
}

async function loadEntries(orgId: string): Promise<WaitlistEntry[]> {
  const row = await prisma.setting.findFirst({
    where: { orgId, key: WAITLIST_KEY },
  });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveEntries(orgId: string, entries: WaitlistEntry[]): Promise<void> {
  await prisma.setting.upsert({
    where: { orgId_key: { orgId, key: WAITLIST_KEY } },
    create: {
      orgId,
      key: WAITLIST_KEY,
      value: JSON.stringify(entries),
      category: 'waitlist',
      label: 'Waitlist Entries',
    },
    update: {
      value: JSON.stringify(entries),
    },
  });
}

/**
 * Check whether two time ranges overlap.
 * Times are compared as "HH:MM" strings within the same date.
 */
function timesOverlap(
  cancelStart: string,
  cancelEnd: string,
  waitStart: string,
  waitEnd: string,
): boolean {
  if (!waitStart || !waitEnd) return true; // No time preference means any time works
  return waitStart < cancelEnd && waitEnd > cancelStart;
}

/**
 * Extract HH:MM from a Date or ISO string.
 */
function toTimeString(dt: Date | string): string {
  const d = typeof dt === 'string' ? new Date(dt) : dt;
  return d.toISOString().slice(11, 16); // "HH:MM"
}

/**
 * Extract YYYY-MM-DD from a Date or ISO string.
 */
function toDateString(dt: Date | string): string {
  const d = typeof dt === 'string' ? new Date(dt) : dt;
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * When a booking is cancelled, check if any waitlist entry matches
 * (same service, overlapping time on the same or unspecified date).
 *
 * Matched entries are updated to 'notified' and the client receives an SMS.
 *
 * @returns Array of matched waitlist entry IDs
 */
export async function checkWaitlistOnCancellation(
  orgId: string,
  cancelledBooking: CancelledBooking,
): Promise<string[]> {
  const entries = await loadEntries(orgId);
  if (entries.length === 0) return [];

  const cancelDate = toDateString(cancelledBooking.startAt);
  const cancelTimeStart = toTimeString(cancelledBooking.startAt);
  const cancelTimeEnd = toTimeString(cancelledBooking.endAt);
  const cancelService = cancelledBooking.service.toLowerCase();

  const matchedIds: string[] = [];

  for (const entry of entries) {
    // Only match entries that are still waiting
    if (entry.status !== 'waiting') continue;

    // Service must match (case-insensitive)
    if (entry.service.toLowerCase() !== cancelService) continue;

    // Date must match if specified on the waitlist entry
    if (entry.preferredDate && entry.preferredDate !== cancelDate) continue;

    // Time must overlap if specified on the waitlist entry
    if (
      entry.preferredTimeStart &&
      entry.preferredTimeEnd &&
      !timesOverlap(cancelTimeStart, cancelTimeEnd, entry.preferredTimeStart, entry.preferredTimeEnd)
    ) {
      continue;
    }

    // Match found — mark as notified
    entry.status = 'notified';
    matchedIds.push(entry.id);

    // Look up client phone for SMS notification
    const client = await (prisma as any).client.findFirst({
      where: { orgId, id: entry.clientId },
      select: { phone: true, firstName: true },
    });

    if (client?.phone) {
      const name = client.firstName || entry.clientName;
      const dateDisplay = cancelDate;
      const timeDisplay =
        cancelTimeStart && cancelTimeEnd
          ? `${cancelTimeStart}-${cancelTimeEnd}`
          : 'the requested time';

      const message =
        `Hi ${name}! A ${cancelledBooking.service} slot just opened up on ${dateDisplay} at ${timeDisplay}. ` +
        `Reply YES to book or contact us for details.`;

      await guardedSend(orgId, 'waitlist_notification', async () => {
        return sendMessage(client.phone, message);
      });
    }
  }

  if (matchedIds.length > 0) {
    await saveEntries(orgId, entries);
  }

  return matchedIds;
}
