/**
 * Booking Form Mapper
 * 
 * Converts booking records to BookingForm initialValues for edit mode.
 * Reuses existing mapper logic.
 * 
 * Note: Booking model not available in messaging dashboard schema.
 * This mapper works with generic booking objects.
 */

export interface BookingFormValues {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  service: string;
  startAt: string; // ISO string
  endAt: string; // ISO string
  pets: Array<{ name: string; species: string }>;
  notes?: string;
  selectedDates?: string[];
  dateTimes?: Record<string, Array<{ time: string; duration: number }>>;
  afterHours?: boolean;
  holiday?: boolean;
  smsConsent?: boolean;
}

/**
 * Map booking record to BookingForm initialValues
 */
export function bookingToFormValues(booking: {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  service: string;
  startAt: Date | string;
  endAt: Date | string;
  notes?: string | null;
  afterHours?: boolean;
  holiday?: boolean;
  pets: Array<{ name: string; species: string }>;
  timeSlots?: Array<{ startAt: Date | string; endAt: Date | string; duration?: number }>;
}): BookingFormValues {
  // Build selectedDates from timeSlots or startAt/endAt
  const selectedDates: string[] = [];
  const dateTimes: Record<string, Array<{ time: string; duration: number }>> = {};

  const isHouseSitting = booking.service === "Housesitting" || booking.service === "24/7 Care";

  if (isHouseSitting && booking.startAt && booking.endAt) {
    // For house sitting: use start and end dates
    const start = new Date(booking.startAt);
    const end = new Date(booking.endAt);
    
    // Generate date range
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      selectedDates.push(dateStr);
      
      // Add time for first and last date
      if (current.getTime() === start.getTime()) {
        dateTimes[dateStr] = [{
          time: `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`,
          duration: 0, // Will be calculated
        }];
      } else if (current.getTime() === end.getTime()) {
        dateTimes[dateStr] = [{
          time: `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`,
          duration: 0,
        }];
      } else {
        dateTimes[dateStr] = [];
      }
      
      current.setDate(current.getDate() + 1);
    }
  } else if (booking.timeSlots && booking.timeSlots.length > 0) {
    // For other services: use timeSlots
    booking.timeSlots.forEach(slot => {
      const slotStart = new Date(slot.startAt);
      const dateStr = slotStart.toISOString().split('T')[0];
      
      if (!selectedDates.includes(dateStr)) {
        selectedDates.push(dateStr);
        dateTimes[dateStr] = [];
      }
      
      const timeStr = `${slotStart.getHours().toString().padStart(2, '0')}:${slotStart.getMinutes().toString().padStart(2, '0')}`;
      dateTimes[dateStr].push({
        time: timeStr,
        duration: slot.duration || 30,
      });
    });
  } else if (booking.startAt) {
    // Fallback: use startAt date
    const start = new Date(booking.startAt);
    const dateStr = start.toISOString().split('T')[0];
    selectedDates.push(dateStr);
    dateTimes[dateStr] = [{
      time: `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`,
      duration: 30,
    }];
  }

  return {
    firstName: booking.firstName,
    lastName: booking.lastName,
    phone: booking.phone,
    email: booking.email || '',
    address: booking.address || '',
    pickupAddress: booking.pickupAddress || '',
    dropoffAddress: booking.dropoffAddress || '',
    service: booking.service,
    startAt: new Date(booking.startAt).toISOString(),
    endAt: new Date(booking.endAt).toISOString(),
    pets: booking.pets.map(p => ({
      name: p.name,
      species: p.species,
    })),
    notes: booking.notes || '',
    selectedDates: selectedDates.length > 0 ? selectedDates : undefined,
    dateTimes: Object.keys(dateTimes).length > 0 ? dateTimes : undefined,
    afterHours: booking.afterHours || false,
    holiday: booking.holiday || false,
  };
}

