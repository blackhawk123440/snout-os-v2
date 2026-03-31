/**
 * @deprecated Legacy calendar sync module. Canonical sync lives in src/lib/calendar/sync.ts
 * (upsertEventForBooking, deleteEventForBooking) and is invoked via the calendar-sync BullMQ queue.
 * Do not import this file; use @/lib/calendar/sync and the queue for new code.
 */

export const calendarSync = {
  async syncBookingToGoogle(_bookingId: string): Promise<void> {
    console.warn('[calendar-sync] Deprecated: use calendar queue + src/lib/calendar/sync.ts');
  },
  async syncFromGoogle(_sitterId: string): Promise<void> {
    console.warn('[calendar-sync] Deprecated: use src/lib/calendar/sync.ts syncRangeForSitter');
  },
};

export async function syncBookingToCalendar(
  _orgId: string,
  _bookingId: string,
  _sitterId?: string,
  _reason?: string
): Promise<void> {
  console.warn('[calendar-sync] Deprecated: use calendar queue + src/lib/calendar/sync.ts');
}

export async function deleteBookingCalendarEvent(
  _orgId: string,
  _bookingId: string,
  _previousSitterId: string,
  _reason?: string
): Promise<void> {
  console.warn('[calendar-sync] Deprecated: use calendar queue delete job + src/lib/calendar/sync.ts');
}

export default calendarSync;
