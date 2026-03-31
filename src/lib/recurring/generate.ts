/**
 * Recurring booking generation engine.
 * Idempotent: running twice doesn't create duplicates.
 */

import { prisma } from '@/lib/db';
import { whereOrg } from '@/lib/org-scope';

export async function generateRecurringBookings(params: {
  scheduleId: string;
  orgId: string;
  daysAhead?: number;
}): Promise<{ created: number; skipped: number }> {
  const { scheduleId, orgId, daysAhead = 14 } = params;

  const schedule = await (prisma as any).recurringSchedule.findFirst({
    where: whereOrg(orgId, { id: scheduleId }),
  });

  if (!schedule || schedule.status !== 'active') {
    return { created: 0, skipped: 0 };
  }

  // Parse schedule config
  const daysOfWeek: number[] | null = schedule.daysOfWeek
    ? JSON.parse(schedule.daysOfWeek)
    : null;
  const petIds: string[] = schedule.petIds ? JSON.parse(schedule.petIds) : [];

  // Get client info for booking fields
  const client = await (prisma as any).client.findFirst({
    where: whereOrg(orgId, { id: schedule.clientId }),
    select: { firstName: true, lastName: true, phone: true, email: true, address: true },
  });
  if (!client) return { created: 0, skipped: 0 };

  // Get pets for the booking
  const pets = petIds.length > 0
    ? await (prisma as any).pet.findMany({
        where: { id: { in: petIds } },
        select: { name: true, species: true },
      })
    : [];

  // Calculate target dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + daysAhead);

  const effectiveFrom = new Date(schedule.effectiveFrom);
  effectiveFrom.setHours(0, 0, 0, 0);
  const effectiveUntil = schedule.effectiveUntil
    ? new Date(schedule.effectiveUntil)
    : null;

  const startFrom = today > effectiveFrom ? today : effectiveFrom;

  const targetDates: Date[] = [];
  const cursor = new Date(startFrom);

  while (cursor <= endDate) {
    if (effectiveUntil && cursor > effectiveUntil) break;

    const dayOfWeek = cursor.getDay(); // 0=Sun, 1=Mon...
    let include = false;

    switch (schedule.frequency) {
      case 'daily':
        include = !daysOfWeek || daysOfWeek.includes(dayOfWeek);
        break;
      case 'weekly':
        include = !daysOfWeek || daysOfWeek.includes(dayOfWeek);
        break;
      case 'biweekly': {
        const weeksSinceStart = Math.floor(
          (cursor.getTime() - effectiveFrom.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        include = weeksSinceStart % 2 === 0 && (!daysOfWeek || daysOfWeek.includes(dayOfWeek));
        break;
      }
      case 'monthly': {
        include = cursor.getDate() === effectiveFrom.getDate();
        break;
      }
    }

    if (include) {
      targetDates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // Parse times
  const [startH, startM] = schedule.startTime.split(':').map(Number);
  const [endH, endM] = schedule.endTime.split(':').map(Number);

  let created = 0;
  let skipped = 0;

  for (const date of targetDates) {
    const startAt = new Date(date);
    startAt.setHours(startH, startM, 0, 0);
    const endAt = new Date(date);
    endAt.setHours(endH, endM, 0, 0);

    // Check if booking already exists for this date + schedule
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await (prisma as any).booking.findFirst({
      where: {
        ...whereOrg(orgId, {}),
        recurringScheduleId: scheduleId,
        startAt: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Create booking
    const bookingData: Record<string, unknown> = {
      orgId,
      clientId: schedule.clientId,
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      phone: client.phone || '',
      email: client.email || null,
      address: schedule.address || client.address || null,
      service: schedule.service,
      startAt,
      endAt,
      totalPrice: schedule.totalPrice,
      status: schedule.sitterId ? 'confirmed' : 'pending',
      sitterId: schedule.sitterId || null,
      notes: schedule.notes || null,
      afterHours: schedule.afterHours,
      holiday: schedule.holiday,
      recurringScheduleId: scheduleId,
    };

    const booking = await (prisma as any).booking.create({
      data: bookingData,
    });

    // Create pets for booking
    if (pets.length > 0) {
      for (const pet of pets) {
        await (prisma as any).pet.create({
          data: {
            orgId,
            name: pet.name,
            species: pet.species,
            bookingId: booking.id,
            clientId: schedule.clientId,
          },
        });
      }
    }

    // Auto-charge or send payment link for recurring bookings with a price
    if (booking.totalPrice > 0) {
      try {
        const { chargeOnConfirmation, getPaymentTiming } = await import('@/lib/payments/auto-charge');
        const timing = await getPaymentTiming(orgId);
        if (timing === 'at_booking') {
          await chargeOnConfirmation({
            bookingId: booking.id,
            orgId,
            clientId: schedule.clientId,
            amount: booking.totalPrice,
            service: schedule.service,
            clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
            clientEmail: client.email,
            clientPhone: client.phone,
          });
        }
      } catch (payErr) {
        console.error(`[recurring] Auto-charge for booking ${booking.id} failed:`, payErr);
      }
    }

    created++;
  }

  // Update lastGeneratedAt
  await (prisma as any).recurringSchedule.update({
    where: { id: scheduleId },
    data: { lastGeneratedAt: new Date() },
  });

  return { created, skipped };
}

export async function generateAllRecurringBookings(params: {
  orgId: string;
  daysAhead?: number;
}): Promise<{ totalCreated: number; totalSkipped: number; schedulesProcessed: number }> {
  const schedules = await (prisma as any).recurringSchedule.findMany({
    where: whereOrg(params.orgId, { status: 'active' }),
    select: { id: true },
  });

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const schedule of schedules) {
    const result = await generateRecurringBookings({
      scheduleId: schedule.id,
      orgId: params.orgId,
      daysAhead: params.daysAhead,
    });
    totalCreated += result.created;
    totalSkipped += result.skipped;
  }

  return { totalCreated, totalSkipped, schedulesProcessed: schedules.length };
}
