import { DEFAULT_RATES, computeQuote, DEFAULT_HOLIDAYS, getRateForService } from "./rates";

export interface Booking {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  service: string;
  startAt: Date;
  endAt: Date;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  totalPrice: number;
  pets: Array<{ species: string }>;
  sitter?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Sitter {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Rate {
  id: string;
  service: string;
  duration: number;
  price: number;
  description: string;
}

export const COLORS = {
  primary: "#432f21",
  primaryLight: "#fce1ef",
  primaryLighter: "#fef7fb",
  secondary: "#e2e8f0",
  accent: "#f8fafc",
  white: "#ffffff",
  gray: "#6b7280",
  border: "#e5e7eb",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
};

export function formatPetsByQuantity(pets: Array<{ species: string }>): string {
  const counts: Record<string, number> = {};
  
  pets.forEach(pet => {
    counts[pet.species] = (counts[pet.species] || 0) + 1;
  });
  
  return Object.entries(counts)
    .map(([species, count]) => `${count} ${species}${count > 1 ? 's' : ''}`)
    .join(', ');
}


export function groupPets(pets: Array<{ species: string }>): Record<string, number> {
  const groups: Record<string, number> = {};
  
  pets.forEach(pet => {
    groups[pet.species] = (groups[pet.species] || 0) + 1;
  });
  
  return groups;
}

export function getPetIcon(species: string): string {
  const iconMap: Record<string, string> = {
    'dog': 'fas fa-dog',
    'cat': 'fas fa-cat',
    'bird': 'fas fa-dove',
    'fish': 'fas fa-fish',
    'rabbit': 'fas fa-rabbit',
    'reptile': 'fas fa-dragon',
    'reptiles': 'fas fa-dragon',
    'farm animal': 'fas fa-horse',
    'farm animals': 'fas fa-horse',
    'farm': 'fas fa-horse',
    'hamster': 'fas fa-paw',
    'guinea pig': 'fas fa-paw',
    'turtle': 'fas fa-paw',
    'snake': 'fas fa-paw',
    'lizard': 'fas fa-paw',
    'ferret': 'fas fa-paw',
    'chinchilla': 'fas fa-paw',
    'hedgehog': 'fas fa-paw',
    'other': 'fas fa-paw'
  };
  
  return iconMap[species.toLowerCase()] || 'fas fa-paw';
}

export function getServiceIcon(service: string): string {
  const iconMap: Record<string, string> = {
    'Dog Walking': 'fas fa-dog',
    'Housesitting': 'fas fa-home',
    'Drop-ins': 'fas fa-bone',
    'Pet Taxi': 'fas fa-car',
    '24/7 Care': 'fas fa-heart',
    'Pet Sitting': 'fas fa-home',
    'Pet Care': 'fas fa-paw'
  };
  
  return iconMap[service] || 'fas fa-paw';
}

export interface PriceBreakdown {
  basePrice: number;
  additionalPets: number;
  holidayAdd: number;
  afterHoursAdd: number;
  quantity: number;
  total: number;
  breakdown: Array<{
    label: string;
    amount: number;
    description?: string;
  }>;
}

export function calculatePriceBreakdown(booking: {
  service: string;
  startAt: Date | string;
  endAt: Date | string;
  pets: Array<{ species: string }>;
  quantity?: number;
  afterHours?: boolean;
  holiday?: boolean;
  totalPrice?: number | null;
  timeSlots?: Array<{ id?: string; startAt: Date | string; endAt: Date | string; duration: number }>;
}): PriceBreakdown {
  const petCount = booking.pets.length;
  const rate = getRateForService(booking.service);
  
  if (!rate) {
    return {
      basePrice: 0,
      additionalPets: 0,
      holidayAdd: 0,
      afterHoursAdd: 0,
      quantity: booking.quantity || 1,
      total: booking.totalPrice || 0,
      breakdown: [{
        label: 'Service Not Found',
        amount: booking.totalPrice || 0,
        description: 'Unable to calculate breakdown'
      }]
    };
  }

  const startDate = booking.startAt instanceof Date ? booking.startAt : new Date(booking.startAt);
  const endDate = booking.endAt instanceof Date ? booking.endAt : new Date(booking.endAt);
  
  const quoteInput = {
    service: booking.service,
    quantity: booking.quantity || 1,
    petCount,
    afterHours: booking.afterHours || false,
    startAt: startDate.toISOString(),
    endAt: endDate.toISOString(),
    holidayDatesISO: DEFAULT_HOLIDAYS,
    rate,
  };

  const holidayApplied = computeQuote(quoteInput).holidayApplied;
  
  const breakdown: Array<{ label: string; amount: number; description?: string }> = [];
  let basePrice = 0;

  if (booking.service === "Housesitting" || booking.service === "24/7 Care") {
    // Calculate nights based on calendar days
    // Nights = calendar days difference - 1 (e.g., Nov 19 to Nov 21 = 3 days = 2 nights)
    const startCalendarDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endCalendarDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    // Count actual calendar days between dates (inclusive of both start and end)
    // Nov 19 to Nov 21 = 3 calendar days (Nov 19, Nov 20, Nov 21)
    const diffTime = endCalendarDay.getTime() - startCalendarDay.getTime();
    const calendarDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
    const diffNights = Math.max(1, calendarDays - 1); // Nights = days - 1
    basePrice = rate.base * diffNights;
    breakdown.push({
      label: `${booking.service} (${diffNights} ${diffNights === 1 ? 'night' : 'nights'})`,
      amount: basePrice,
      description: `$${rate.base} × ${diffNights} nights`
    });
    
    // Add additional pets cost for house sitting and 24/7 care
    const addlPets = Math.max(petCount - 1, 0);
    if (addlPets > 0) {
      const addlPetTotal = addlPets * rate.addlPet * diffNights;
      basePrice += addlPetTotal;
      breakdown.push({
        label: `Additional Pets (${addlPets})`,
        amount: addlPetTotal,
          description: `$${rate.addlPet} × ${addlPets} × ${diffNights} nights`
      });
    }
  } else {
    // Visit-based services: price per time slot, supporting 30/60 minute pricing
    const hasSlots = Array.isArray(booking.timeSlots) && booking.timeSlots.length > 0;
    if (hasSlots) {
      const addlPets = Math.max(petCount - 1, 0);
      let count30 = 0;
      let count60 = 0;
      booking.timeSlots!.forEach(ts => {
        const dur = typeof ts.duration === 'number' ? ts.duration : 30;
        if (dur >= 60) count60++; else count30++;
      });
      const per30 = rate.base;
      const per60 = rate.base60 ?? rate.base;
      const holidayAddPerVisit = holidayApplied ? rate.holidayAdd : 0;
      // Additional pets: $5 per additional pet per visit for Drop-ins, Dog Walking, Pet Taxi
      // $10 per additional pet per visit for House sitting, 24/7 Care
      const addlPetsPerVisit = addlPets * rate.addlPet;
      const afterHoursPerVisit = booking.afterHours ? 0 : 0;

      // Calculate base price without additional pets (they'll be added separately)
      const base30 = count30 * (per30 + holidayAddPerVisit + afterHoursPerVisit);
      const base60 = count60 * (per60 + holidayAddPerVisit + afterHoursPerVisit);
      basePrice = base30 + base60;

      if (count30 > 0) {
        breakdown.push({
          label: `${booking.service} (30 min × ${count30})`,
          amount: count30 * per30,
          description: `$${per30} × ${count30} visits`
        });
      }
      if (count60 > 0) {
        breakdown.push({
          label: `${booking.service} (60 min × ${count60})`,
          amount: count60 * per60,
          description: `$${per60} × ${count60} visits`
        });
      }

      if (addlPetsPerVisit > 0) {
        const visits = count30 + count60;
        const additionalPetsAmount = addlPetsPerVisit * visits;
        breakdown.push({
          label: `Additional Pets (${addlPets})`,
          amount: additionalPetsAmount,
          description: `$${rate.addlPet} × ${addlPets} × ${visits} visits`
        });
      }

      if (holidayAddPerVisit > 0) {
        const visits = count30 + count60;
        breakdown.push({
          label: `Holiday Rate`,
          amount: holidayAddPerVisit * visits,
          description: `$${rate.holidayAdd} × ${visits} visits`
        });
      }

    } else {
      // For services without timeSlots (Housesitting, 24/7 Care), calculate based on nights
      const startDate = new Date(booking.startAt);
      const endDate = new Date(booking.endAt);
      // Calculate nights: calendar days difference - 1 (e.g., Nov 19 to Nov 21 = 3 days = 2 nights)
      const startCalendarDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endCalendarDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      // Count actual calendar days between dates (inclusive of both start and end)
      const diffTime = endCalendarDay.getTime() - startCalendarDay.getTime();
      const calendarDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
      const diffNights = Math.max(1, calendarDays - 1); // Nights = days - 1
      const quantity = diffNights; // Number of nights
      const addlPets = Math.max(petCount - 1, 0);
      basePrice = rate.base * quantity;
      breakdown.push({
        label: `${booking.service} (${quantity} ${quantity === 1 ? 'visit' : 'visits'})`,
        amount: basePrice,
        description: `$${rate.base} × ${quantity} visits`
      });

      // Add additional pets cost
      if (addlPets > 0) {
        const addlPetTotal = addlPets * rate.addlPet * quantity;
        basePrice += addlPetTotal;
        breakdown.push({
          label: `Additional Pets (${addlPets})`,
          amount: addlPetTotal,
          description: `$${rate.addlPet} × ${addlPets} × ${quantity} visits`
        });
      }

      if (holidayApplied) {
        const holidayTotal = rate.holidayAdd * quantity;
        breakdown.push({
          label: `Holiday Rate`,
          amount: holidayTotal,
          description: `$${rate.holidayAdd} × ${quantity} visits`
        });
      }
    }
  }

  // Overtime removed - no longer calculating overtime charges
  let overtimeTotal = 0;

  // After hours (kept as separate line only if used as a flat fee; currently 0)
  let afterHoursTotal = 0;
  if (booking.afterHours) {
    // If changed in future to a flat fee, adjust here
    afterHoursTotal = 0;
  }

  // Calculate additional pets total separately for visit-based services with timeSlots
  // (For house sitting/24-7 care, additional pets are already added to basePrice above)
  // (For services without timeSlots, additional pets are already added to basePrice in the else block)
  let additionalPetsTotal = 0;
  const isHouseSittingService = booking.service === "Housesitting" || booking.service === "24/7 Care";
  if (!isHouseSittingService && Array.isArray(booking.timeSlots) && booking.timeSlots.length > 0) {
    // For visit-based services with timeSlots, additional pets are calculated separately
    // We need to calculate the same way as in the breakdown above
    const addlPets = Math.max(petCount - 1, 0);
    if (addlPets > 0) {
      // Count visits the same way as in the breakdown (count30 + count60)
      let count30 = 0;
      let count60 = 0;
      booking.timeSlots.forEach(ts => {
        const dur = typeof ts.duration === 'number' ? ts.duration : 30;
        if (dur >= 60) count60++; else count30++;
      });
      const visits = count30 + count60;
      additionalPetsTotal = addlPets * rate.addlPet * visits;
    }
  }
  // For house sitting/24-7 care, additional pets are already in basePrice (added at line 200)
  // For services without timeSlots, additional pets are already in basePrice (added at line 263)

  const total = basePrice + additionalPetsTotal + afterHoursTotal;

  return {
    basePrice,
    additionalPets: 0, // rolled into per-visit above when slots are present
    holidayAdd: 0,     // rolled into per-visit above when slots are present
    afterHoursAdd: afterHoursTotal,
    quantity: booking.timeSlots?.length || booking.quantity || 1,
    total: Number(total.toFixed(2)),
    breakdown
  };
}

export function isValidStatus(status: string): status is "pending" | "confirmed" | "completed" | "cancelled" {
  return ["pending", "confirmed", "completed", "cancelled"].includes(status);
}

export function isValidService(service: string): service is "Dog Walking" | "Pet Sitting" | "Pet Boarding" | "Pet Grooming" {
  return ["Dog Walking", "Pet Sitting", "Pet Boarding", "Pet Grooming"].includes(service);
}

export interface TimeConflict {
  bookingId: string;
  startAt: Date;
  endAt: Date;
}

export interface SitterConflict {
  sitterId: string;
  conflicts: TimeConflict[];
}

export function hasTimeConflict(
  startAt: Date,
  endAt: Date,
  existingBookings: Array<{ startAt: Date; endAt: Date }>
): boolean {
  return existingBookings.some(booking => {
    return (
      (startAt < booking.endAt && endAt > booking.startAt) ||
      (booking.startAt < endAt && booking.endAt > startAt)
    );
  });
}

export function hasSitterConflict(
  sitterId: string,
  startAt: Date,
  endAt: Date,
  existingBookings: Array<{ sitterId: string; startAt: Date; endAt: Date }>
): boolean {
  const sitterBookings = existingBookings.filter(booking => booking.sitterId === sitterId);
  return hasTimeConflict(startAt, endAt, sitterBookings);
}

export function getBookingConflicts(
  booking: { id?: string; startAt: Date; endAt: Date; sitterId?: string },
  allBookings: Array<{ id: string; startAt: Date; endAt: Date; sitterId?: string }>
): Array<{ id: string; startAt: Date; endAt: Date }> {
  return allBookings
    .filter(b => !booking.id || b.id !== booking.id)
    .filter(b => {
      if (booking.sitterId && b.sitterId && booking.sitterId !== b.sitterId) {
        return false;
      }
      return hasTimeConflict(booking.startAt, booking.endAt, [b]);
    })
    .map(b => ({ id: b.id, startAt: b.startAt, endAt: b.endAt }));
}

export function getConflictStatus(
  booking: { startAt: Date; endAt: Date; sitterId?: string },
  allBookings: Array<{ id: string; startAt: Date; endAt: Date; sitterId?: string }>
): "none" | "time" | "sitter" {
  const conflicts = getBookingConflicts(booking, allBookings);
  
  if (conflicts.length === 0) {
    return "none";
  }
  
  const sitterConflicts = conflicts.filter(c => {
    const conflictBooking = allBookings.find(b => b.id === c.id);
    return conflictBooking?.sitterId === booking.sitterId;
  });
  
  return sitterConflicts.length > 0 ? "sitter" : "time";
}

/**
 * Format client name for sitter messages: "FirstName LastInitial"
 * Example: "John Doe" -> "John D"
 */
export function formatClientNameForSitter(firstName: string, lastName: string): string {
  if (!firstName) return lastName || '';
  if (!lastName) return firstName;
  const lastInitial = lastName.charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}`;
}

/**
 * Format date with abbreviated month and no year for automated messages
 * Example: "Jan 5"
 * Updated to use short format to match unified date/time formatting across all messages
 */
export function formatDateForMessage(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatDateShortForMessage(dateObj);
}

/**
 * Format date with abbreviated month and no year for automated messages
 * Example: "Jan 5"
 */
export function formatDateShortForMessage(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time to match booking details page format
 * Uses UTC methods to get original time components (since dates are stored with local time as UTC)
 * Formats as "H:MM AM/PM"
 */
export function formatTimeForMessage(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  // Dates are stored with local time as UTC, so use UTC methods to get the original time
  const hours = dateObj.getUTCHours();
  const minutes = dateObj.getUTCMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Format dates and times for automated messages
 * Matches the exact format used in booking details page
 * Handles both timeSlots (visit-based services) and date ranges (house sitting)
 */
export function formatDatesAndTimesForMessage(booking: {
  service: string;
  startAt: Date | string;
  endAt: Date | string;
  timeSlots?: Array<{ startAt: Date | string; endAt: Date | string; duration: number }>;
}): string {
  const isHouseSittingService = booking.service === "Housesitting" || booking.service === "24/7 Care";
  const hasTimeSlots = Array.isArray(booking.timeSlots) && booking.timeSlots.length > 0;

  // For visit-based services with timeSlots, group by date and show all times
  if (hasTimeSlots && !isHouseSittingService) {
    // Group timeSlots by date
    const slotsByDate: Record<string, Array<{ startAt: Date; endAt: Date; duration: number }>> = {};
    
    booking.timeSlots!.forEach(slot => {
      const slotStart = typeof slot.startAt === 'string' ? new Date(slot.startAt) : slot.startAt;
      const slotEnd = typeof slot.endAt === 'string' ? new Date(slot.endAt) : slot.endAt;
      const dateKey = formatDateShortForMessage(slotStart);
      
      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
      }
      slotsByDate[dateKey].push({ startAt: slotStart, endAt: slotEnd, duration: slot.duration });
    });

    // Format each date with its time slots
    const dateStrings = Object.keys(slotsByDate).sort().map(dateKey => {
      const slots = slotsByDate[dateKey];
      const timeStrings = slots.map(slot => {
        const startTime = formatTimeForMessage(slot.startAt);
        return `${startTime} (${slot.duration} min)`;
      });
      return `${dateKey}\n${timeStrings.join('\n')}`;
    });

    return dateStrings.join('\n\n');
  }

  // For house sitting/24-7 care, show date range
  if (isHouseSittingService) {
    const startDate = typeof booking.startAt === 'string' ? new Date(booking.startAt) : booking.startAt;
    const endDate = typeof booking.endAt === 'string' ? new Date(booking.endAt) : booking.endAt;
    
    const startDateStr = formatDateShortForMessage(startDate);
    const startTimeStr = formatTimeForMessage(startDate);
    const endDateStr = formatDateShortForMessage(endDate);
    const endTimeStr = formatTimeForMessage(endDate);
    
    return `Start: ${startDateStr} at ${startTimeStr}\nEnd: ${endDateStr} at ${endTimeStr}`;
  }

  // Fallback: single date/time
  const startDate = typeof booking.startAt === 'string' ? new Date(booking.startAt) : booking.startAt;
  const dateStr = formatDateShortForMessage(startDate);
  const timeStr = formatTimeForMessage(startDate);
  
  return `${dateStr} at ${timeStr}`;
}