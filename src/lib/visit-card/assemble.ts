/**
 * Visit Card Assembly
 *
 * Collects GPS data, photos, pet checklists, and sitter notes from
 * a completed visit and assembles them into a VisitCard record.
 * Called after sitter check-out + report submission.
 */

import { prisma } from '@/lib/db';

export async function assembleVisitCard(bookingId: string, orgId: string): Promise<string | null> {
  const booking = await (prisma as any).booking.findFirst({
    where: { id: bookingId, orgId },
    select: {
      id: true,
      orgId: true,
      clientId: true,
      sitterId: true,
      startAt: true,
      endAt: true,
      service: true,
      pets: { select: { id: true, name: true, species: true } },
      sitter: { select: { firstName: true, lastName: true } },
    },
  });

  if (!booking?.clientId || !booking?.sitterId) return null;

  // Get visit event for GPS and timestamps
  const visitEvent = await (prisma as any).visitEvent.findFirst({
    where: { bookingId, orgId },
    orderBy: { createdAt: 'desc' },
    select: { checkInAt: true, checkOutAt: true },
  });

  // Get the latest report
  const report = await (prisma as any).report.findFirst({
    where: { bookingId, orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      content: true,
      mediaUrls: true,
      petReports: true,
      personalNote: true,
    },
  });

  // Get GPS data from event logs
  const gpsEvents = await (prisma as any).eventLog.findMany({
    where: {
      bookingId,
      orgId,
      eventType: { in: ['sitter.check_in', 'sitter.check_out'] },
    },
    select: { eventType: true, metadata: true },
    orderBy: { createdAt: 'asc' },
  });

  let checkInLat: number | null = null;
  let checkInLng: number | null = null;
  let checkOutLat: number | null = null;
  let checkOutLng: number | null = null;

  for (const evt of gpsEvents) {
    try {
      const meta = typeof evt.metadata === 'string' ? JSON.parse(evt.metadata) : evt.metadata;
      if (evt.eventType === 'sitter.check_in' && meta?.lat && meta?.lng) {
        checkInLat = meta.lat;
        checkInLng = meta.lng;
      }
      if (evt.eventType === 'sitter.check_out' && meta?.lat && meta?.lng) {
        checkOutLat = meta.lat;
        checkOutLng = meta.lng;
      }
    } catch { /* ignore parse errors */ }
  }

  const checkInAt = visitEvent?.checkInAt ?? booking.startAt;
  const checkOutAt = visitEvent?.checkOutAt ?? booking.endAt;
  const durationMinutes = Math.max(1, Math.round(
    (new Date(checkOutAt).getTime() - new Date(checkInAt).getTime()) / 60000
  ));

  // Parse photo URLs and pet checklists from report
  let photoUrls: string[] = [];
  let petChecklists: any[] = [];
  let sitterNote: string | null = null;

  if (report) {
    try {
      if (report.mediaUrls) photoUrls = JSON.parse(report.mediaUrls);
    } catch { /* ignore */ }
    try {
      if (report.petReports) petChecklists = JSON.parse(report.petReports);
    } catch { /* ignore */ }
    sitterNote = report.personalNote || report.content || null;
  }

  const card = await (prisma as any).visitCard.upsert({
    where: { bookingId },
    create: {
      orgId,
      bookingId,
      clientId: booking.clientId,
      sitterId: booking.sitterId,
      checkInAt: new Date(checkInAt),
      checkOutAt: new Date(checkOutAt),
      durationMinutes,
      checkInLat,
      checkInLng,
      checkOutLat,
      checkOutLng,
      photoUrls: JSON.stringify(photoUrls),
      petChecklists: JSON.stringify(petChecklists),
      sitterNote,
    },
    update: {
      checkInAt: new Date(checkInAt),
      checkOutAt: new Date(checkOutAt),
      durationMinutes,
      checkInLat,
      checkInLng,
      checkOutLat,
      checkOutLng,
      photoUrls: JSON.stringify(photoUrls),
      petChecklists: JSON.stringify(petChecklists),
      sitterNote,
    },
  });

  return card.id;
}
