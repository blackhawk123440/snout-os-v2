import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/lib/ai';
import { getScopedDb } from '@/lib/tenancy';
import { publish, channels } from '@/lib/realtime/bus';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, assertOrgAccess, ForbiddenError } from '@/lib/rbac';
import { InvariantError, invariantErrorResponse } from '@/lib/invariant';
import { pushReportPosted } from '@/lib/notifications/push-dispatch';

/**
 * POST /api/bookings/[id]/daily-delight
 * Generate and store an AI Daily Delight report for a pet on this booking.
 * Optionally sends the report via SMS to the client (when Twilio is configured).
 * Body: { petId?: string } — if omitted, uses the booking's first pet.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin', 'sitter']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bookingId } = await params;
  let body: {
    petId?: string;
    tone?: 'warm' | 'playful' | 'professional';
    mediaUrls?: string[];
    /** If provided, use this instead of AI generation (offline sync flow) */
    report?: string;
    // Structured fields
    walkDuration?: number;
    pottyNotes?: string;
    foodNotes?: string;
    waterNotes?: string;
    medicationNotes?: string;
    behaviorNotes?: string;
    personalNote?: string;
    checkOutLat?: number;
    checkOutLng?: number;
    petReports?: string;  // JSON string
  } = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }

  const mediaUrls = Array.isArray(body.mediaUrls)
    ? body.mediaUrls.filter((u): u is string => typeof u === 'string').slice(0, 5)
    : [];

  const db = getScopedDb(ctx);
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { pets: true, client: true },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  try {
    assertOrgAccess(booking.orgId, ctx.orgId);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (ctx.role === 'sitter' && ctx.sitterId && booking.sitterId !== ctx.sitterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const petId = body.petId ?? booking.pets?.[0]?.id;
  if (!petId && !body.report) {
    return NextResponse.json(
      { error: 'No pets on this booking' },
      { status: 400 }
    );
  }

  let report: string;
  try {
    report = typeof body.report === 'string' && body.report.trim()
      ? body.report.trim()
      : await ai.generateDailyDelight(petId!, bookingId, body.tone);
  } catch (err) {
    if (err instanceof InvariantError) {
      return NextResponse.json(invariantErrorResponse(err), { status: err.code });
    }
    throw err;
  }

  let reportId: string | null = null;
  if (report) {
    try {
      const created = await db.report.create({
        data: {
          bookingId,
          sitterId: booking.sitterId ?? null,
          clientId: booking.clientId ?? null,
          content: report,
          mediaUrls: mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null,
          walkDuration: typeof body.walkDuration === 'number' ? body.walkDuration : null,
          pottyNotes: body.pottyNotes?.trim() || null,
          foodNotes: body.foodNotes?.trim() || null,
          waterNotes: body.waterNotes?.trim() || null,
          medicationNotes: body.medicationNotes?.trim() || null,
          behaviorNotes: body.behaviorNotes?.trim() || null,
          personalNote: body.personalNote?.trim() || null,
          petReports: body.petReports || null,
          checkOutLat: typeof body.checkOutLat === 'number' ? body.checkOutLat : null,
          checkOutLng: typeof body.checkOutLng === 'number' ? body.checkOutLng : null,
          visitStarted: booking.startAt,
          visitCompleted: booking.endAt,
          sentToClient: true,
          sentAt: new Date(),
        },
      });
      reportId = created.id;
      if (booking.sitterId) {
        publish(channels.sitterToday(booking.orgId ?? 'default', booking.sitterId), {
          type: 'delight.created',
          bookingId,
          ts: Date.now(),
        }).catch(() => {});
      }
      // N8: Check for medication missed alert
      const medNotes = body.medicationNotes?.trim()?.toLowerCase() || '';
      const medMissed = !medNotes || medNotes === 'not given' || medNotes === 'refused' || medNotes === 'n/a';
      if (medMissed && booking.pets?.length > 0) {
        // Check if any pet on this booking has medication instructions
        const petsWithMeds = booking.pets.filter((p: any) => p.medicationNotes?.trim());
        if (petsWithMeds.length > 0) {
          const sitter = booking.sitterId
            ? await db.sitter.findUnique({ where: { id: booking.sitterId }, select: { firstName: true, lastName: true } })
            : null;
          void import('@/lib/notifications/triggers').then(({ notifyOwnerMedicationMissed }) => {
            for (const pet of petsWithMeds) {
              notifyOwnerMedicationMissed({
                orgId: booking.orgId ?? 'default',
                bookingId,
                sitterName: sitter ? `${sitter.firstName} ${sitter.lastName}`.trim() : 'Sitter',
                petName: pet.name || 'Pet',
              });
            }
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error('[daily-delight] Failed to create Report (non-blocking):', e);
    }
  }

  // Push notification for report posted (fire and forget)
  if (reportId && booking.clientId && booking.sitterId) {
    const sitter = await db.sitter.findUnique({
      where: { id: booking.sitterId },
      select: { firstName: true, lastName: true },
    });
    const petNames = (booking.pets || []).map((p: any) => p.name).filter(Boolean).join(', ');
    pushReportPosted({
      clientId: booking.clientId,
      sitterName: sitter ? `${sitter.firstName} ${sitter.lastName}`.trim() : 'Your sitter',
      petNames,
      reportId,
    }).catch(() => {});
  }

  // Auto-send report via SMS when Twilio is configured
  const client = booking.client;
  const clientPhone = client?.phone?.trim();
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (accountSid && fromNumber && clientPhone && report) {
    try {
      const toE164 = clientPhone.startsWith('+') ? clientPhone : `+1${clientPhone.replace(/\D/g, '')}`;

      // TCPA compliance: check opt-out before sending
      const { prisma: db } = await import('@/lib/db');
      const optOut = await (db as any).optOutState.findFirst({
        where: { phoneE164: toE164, state: 'opted_out' },
      }).catch(() => null);
      if (optOut) {
        console.warn('[daily-delight] SMS blocked: recipient opted out');
      } else {
        const twilio = require('twilio') as typeof import('twilio');
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        if (authToken) {
          const clientName = client
            ? `${client.firstName} ${client.lastName}`.trim() || 'Your sitter'
            : 'Your sitter';
          const smsBody = `🐾 Daily Delight from ${clientName}'s sitter:\n\n${report}\n\n- Snout OS`;
          const twilioClient = twilio(accountSid, authToken);
          await twilioClient.messages.create({
            body: smsBody,
            from: fromNumber,
            to: toE164,
          });
        }
      }
    } catch (e) {
      console.error('[daily-delight] SMS send failed (non-blocking):', e);
    }
  }

  // SSE: notify client report is ready
  if (booking.clientId && reportId) {
    const { publish: pub, channels: ch } = await import('@/lib/realtime/bus');
    pub(ch.clientBooking(ctx.orgId, booking.clientId), {
      type: 'report.posted',
      bookingId,
      reportId,
      ts: Date.now(),
    }).catch(() => {});
  }

  return NextResponse.json({ report, reportId });
}
