/**
 * One-way calendar sync: Snout OS → Google Calendar
 * Source of truth: Snout OS. Google is a mirror.
 */

import { createHash } from 'crypto';
import { google } from 'googleapis';
import type { PrismaClient } from '@prisma/client';
import { logEvent } from '@/lib/log-event';

const calendar = google.calendar('v3');
const DEFAULT_TIMEZONE = 'America/Chicago';
const DEFAULT_DAYS_RANGE = 14;

function getOAuth2Client(): InstanceType<typeof google.auth.OAuth2> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth not configured');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function computePayloadChecksum(payload: Record<string, unknown>): string {
  const str = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(str).digest('hex').slice(0, 32);
}

function buildEventPayload(booking: {
  startAt: Date;
  endAt: Date;
  service: string;
  firstName: string;
  lastName: string;
  client?: { firstName: string; lastName: string } | null;
  pets?: { name: string }[];
  notes?: string | null;
  id: string;
  orgId?: string;
}, sitter: { firstName: string; lastName: string; id: string }): Record<string, unknown> {
  const clientName = booking.client
    ? `${booking.client.firstName} ${booking.client.lastName}`.trim() || 'Client'
    : `${booking.firstName} ${booking.lastName}`.trim() || 'Client';
  const petLabel = booking.pets?.length && booking.pets[0]?.name ? booking.pets[0].name : 'Pet';
  const sitterName = `${sitter.firstName} ${sitter.lastName}`.trim() || 'Sitter';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.snoutos.com';
  const bookingLink = `${baseUrl}/bookings/${booking.id}`;

  return {
    summary: `${petLabel} – ${clientName} (${booking.service})`,
    description: `Snout OS Booking\nClient: ${clientName}\nSitter: ${sitterName}\nService: ${booking.service}\nNotes: ${booking.notes ?? ''}\n\nBooking: ${bookingLink}`,
    start: {
      dateTime: new Date(booking.startAt).toISOString(),
      timeZone: DEFAULT_TIMEZONE,
    },
    end: {
      dateTime: new Date(booking.endAt).toISOString(),
      timeZone: DEFAULT_TIMEZONE,
    },
    extendedProperties: {
      private: {
        snoutBookingId: booking.id,
        snoutOrgId: booking.orgId ?? 'default',
        snoutSitterId: sitter.id,
        snoutSource: 'snout-os',
      },
    },
  };
}

async function ensureValidToken(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>,
  refreshToken: string
): Promise<void> {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    if (credentials.access_token) {
      oauth2Client.setCredentials(credentials);
    }
  } catch (e) {
    throw new Error(`Google token refresh failed: ${(e as Error).message}`);
  }
}

export interface UpsertResult {
  action: 'created' | 'updated' | 'skipped';
  googleEventId?: string;
  error?: string;
}

/**
 * Upsert a Google Calendar event for a booking.
 * Skips update if payload checksum unchanged.
 */
export async function upsertEventForBooking(
  db: PrismaClient,
  bookingId: string,
  orgId: string
): Promise<UpsertResult> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { client: true, pets: true, sitter: true },
  });
  if (!booking?.sitterId || !booking.sitter) return { action: 'skipped' };

  const sitter = booking.sitter;
  if (!sitter.googleRefreshToken?.trim() || !sitter.calendarSyncEnabled) {
    return { action: 'skipped' };
  }

  const payload = buildEventPayload(booking, sitter);
  const checksum = computePayloadChecksum(payload);

  const existing = await db.bookingCalendarEvent.findFirst({
    where: { bookingId, sitterId: sitter.id },
  });

  if (existing?.payloadChecksum === checksum && existing.googleCalendarEventId) {
    return { action: 'skipped' };
  }

  const oauth2Client = getOAuth2Client();
  await ensureValidToken(oauth2Client, sitter.googleRefreshToken);
  const calendarId = sitter.googleCalendarId ?? 'primary';

  let googleEventIdToUse: string | null = existing?.googleCalendarEventId ?? null;

  try {
    if (googleEventIdToUse) {
      try {
        await calendar.events.patch({
          auth: oauth2Client,
          calendarId,
          eventId: googleEventIdToUse,
          requestBody: payload,
        });
      } catch (patchErr: unknown) {
        const err = patchErr as { code?: number };
        if (err?.code === 404) {
          googleEventIdToUse = null;
        } else {
          throw patchErr;
        }
      }
    }

    if (!googleEventIdToUse) {
      const res = await calendar.events.insert({
        auth: oauth2Client,
        calendarId,
        requestBody: {
          summary: payload.summary as string,
          description: payload.description as string,
          start: payload.start as { dateTime: string; timeZone: string },
          end: payload.end as { dateTime: string; timeZone: string },
          extendedProperties: payload.extendedProperties as { private?: Record<string, string> },
        },
      });
      const googleEventId = res.data?.id;
      if (googleEventId) {
        await db.bookingCalendarEvent.upsert({
          where: { bookingId_sitterId: { bookingId, sitterId: sitter.id } },
          create: {
            orgId,
            bookingId,
            sitterId: sitter.id,
            googleCalendarEventId: googleEventId,
            payloadChecksum: checksum,
            lastSyncedAt: new Date(),
          },
          update: {
            googleCalendarEventId: googleEventId,
            payloadChecksum: checksum,
            lastSyncedAt: new Date(),
          },
        });
        return { action: 'created', googleEventId };
      }
    } else {
      await db.bookingCalendarEvent.update({
        where: { bookingId_sitterId: { bookingId, sitterId: sitter.id } },
        data: { googleCalendarEventId: googleEventIdToUse, payloadChecksum: checksum, lastSyncedAt: new Date() },
      });
      return { action: 'updated', googleEventId: googleEventIdToUse! };
    }
  } catch (e) {
    // Rethrow so worker records failure and BullMQ can retry / dead-letter
    throw e;
  }
  return { action: 'skipped' };
}

/**
 * Delete Google Calendar event for a booking+sitter.
 */
export async function deleteEventForBooking(
  db: PrismaClient,
  bookingId: string,
  sitterId: string,
  orgId: string
): Promise<{ deleted: boolean; error?: string }> {
  const mapping = await db.bookingCalendarEvent.findFirst({
    where: { bookingId, sitterId },
  });
  if (!mapping?.googleCalendarEventId) {
    await db.bookingCalendarEvent.deleteMany({
      where: { bookingId, sitterId },
    });
    return { deleted: true };
  }

  const sitter = await db.sitter.findUnique({
    where: { id: sitterId },
    select: { googleRefreshToken: true, googleCalendarId: true },
  });
  if (!sitter?.googleRefreshToken?.trim()) {
    await db.bookingCalendarEvent.deleteMany({ where: { bookingId, sitterId } });
    return { deleted: true };
  }

  const oauth2Client = getOAuth2Client();
  await ensureValidToken(oauth2Client, sitter.googleRefreshToken);
  const calendarId = sitter.googleCalendarId ?? 'primary';

  try {
    await calendar.events.delete({
      auth: oauth2Client,
      calendarId,
      eventId: mapping.googleCalendarEventId,
    });
  } catch (e) {
    const err = e as { code?: number };
    if (err?.code !== 404) {
      // Rethrow so worker records failure and BullMQ can retry / dead-letter
      throw e;
    }
    // 404: event already gone, continue to remove mapping
  }

  await db.bookingCalendarEvent.deleteMany({ where: { bookingId, sitterId } });
  return { deleted: true };
}

export interface SyncRangeResult {
  created: number;
  updated: number;
  skipped: number;
  deleted: number;
  errors: string[];
}

/**
 * Sync all bookings for a sitter in a date range to Google.
 * Repairs drift (recreates if event was deleted in Google).
 */
export async function syncRangeForSitter(
  db: PrismaClient,
  sitterId: string,
  start: Date,
  end: Date,
  orgId: string
): Promise<SyncRangeResult> {
  const result: SyncRangeResult = { created: 0, updated: 0, skipped: 0, deleted: 0, errors: [] };

  const sitter = await db.sitter.findUnique({
    where: { id: sitterId },
    select: { googleRefreshToken: true, calendarSyncEnabled: true },
  });
  if (!sitter?.googleRefreshToken?.trim() || !sitter.calendarSyncEnabled) {
    return result;
  }

  const bookings = await db.booking.findMany({
    where: {
      sitterId,
      orgId,
      status: { not: 'cancelled' },
      startAt: { gte: start, lte: end },
    },
    select: { id: true },
  });

  for (const booking of bookings) {
    const r = await upsertEventForBooking(db, booking.id, orgId);
    if (r.error) result.errors.push(`${booking.id}: ${r.error}`);
    else if (r.action === 'created') result.created++;
    else if (r.action === 'updated') result.updated++;
    else result.skipped++;
  }

  const mappings = await db.bookingCalendarEvent.findMany({
    where: { sitterId, orgId },
    include: { booking: true },
  });
  for (const m of mappings) {
    if (!m.booking || m.booking.status === 'cancelled') {
      await deleteEventForBooking(db, m.bookingId, sitterId, orgId);
      result.deleted++;
    }
  }

  return result;
}

/**
 * Get busy ranges from Google Calendar for a sitter (for "Respect Google Busy").
 * Returns transient busy blocks; does not persist.
 */
export async function getGoogleBusyRanges(
  db: PrismaClient,
  sitterId: string,
  start: Date,
  end: Date
): Promise<{ start: Date; end: Date }[]> {
  const sitter = await db.sitter.findUnique({
    where: { id: sitterId },
    select: { googleRefreshToken: true, respectGoogleBusy: true, googleCalendarId: true },
  });
  if (!sitter?.respectGoogleBusy || !sitter.googleRefreshToken?.trim()) {
    return [];
  }

  const oauth2Client = getOAuth2Client();
  await ensureValidToken(oauth2Client, sitter.googleRefreshToken);
  const calendarId = sitter.googleCalendarId ?? 'primary';

  try {
    const res = await calendar.freebusy.query({
      auth: oauth2Client,
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const cal = res.data.calendars?.[calendarId];
    if (!cal?.busy) return [];

    return (cal.busy || []).map((b) => ({
      start: new Date(b.start!),
      end: new Date(b.end!),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch recently changed events from a sitter's Google Calendar.
 * Returns InboundExternalEvent[] suitable for processInboundReconcileJob.
 * Uses events.list with updatedMin to find events changed since lastCheck.
 */
export async function fetchGoogleCalendarChanges(
  db: PrismaClient,
  sitterId: string,
  since: Date,
  orgId: string
): Promise<{ events: import('./bidirectional-adapter').InboundExternalEvent[]; error?: string }> {
  const sitter = await db.sitter.findUnique({
    where: { id: sitterId },
    select: { googleRefreshToken: true, calendarSyncEnabled: true, googleCalendarId: true },
  });
  if (!sitter?.googleRefreshToken?.trim() || !sitter.calendarSyncEnabled) {
    return { events: [] };
  }

  try {
    const oauth2Client = getOAuth2Client();
    await ensureValidToken(oauth2Client, sitter.googleRefreshToken);
    const calendarId = sitter.googleCalendarId ?? 'primary';

    const res = await calendar.events.list({
      auth: oauth2Client,
      calendarId,
      updatedMin: since.toISOString(),
      showDeleted: true, // Include cancelled/deleted events
      singleEvents: true,
      maxResults: 250,
      orderBy: 'updated',
    });

    const googleEvents = res.data.items ?? [];

    const events: import('./bidirectional-adapter').InboundExternalEvent[] = [];
    for (const ge of googleEvents) {
      if (!ge.id) continue;

      // Skip Snout-created events (prevent echo loop)
      const snoutSource = ge.extendedProperties?.private?.snoutSource;
      if (snoutSource === 'snout-os') continue;

      if (ge.status === 'cancelled') {
        events.push({
          externalEventId: ge.id,
          action: 'deleted',
          updatedAt: ge.updated ?? undefined,
        });
      } else {
        const startAt = ge.start?.dateTime ?? ge.start?.date;
        const endAt = ge.end?.dateTime ?? ge.end?.date;
        events.push({
          externalEventId: ge.id,
          action: 'upserted',
          startAt: startAt ?? undefined,
          endAt: endAt ?? undefined,
          updatedAt: ge.updated ?? undefined,
        });
      }
    }

    return { events };
  } catch (err) {
    return { events: [], error: err instanceof Error ? err.message : String(err) };
  }
}
