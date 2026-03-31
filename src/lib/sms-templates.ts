import { sendMessage } from "@/lib/message-utils";
import { formatPetsByQuantity, formatClientNameForSitter } from "@/lib/booking-utils";
import { getOwnerPhone, getSitterPhone } from "@/lib/phone-utils";

function isMaskedOnlyEnforced(): boolean {
  return process.env.ENFORCE_MASKED_ONLY_MESSAGING === "true" || process.env.NODE_ENV === "production";
}

function directSendAllowed(audience: "client" | "sitter" | "owner"): boolean {
  if (!isMaskedOnlyEnforced()) return true;
  return audience === "owner";
}

async function sendDirectMessageOrFail(
  audience: "client" | "sitter" | "owner",
  to: string | null | undefined,
  message: string
): Promise<boolean> {
  if (!to) return false;
  if (!directSendAllowed(audience)) {
    console.error(`[sms-templates] Blocked raw direct-send for ${audience}; masked thread delivery is required.`);
    return false;
  }
  return sendMessage(to, message);
}

export interface Booking {
  id: string;
  orgId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address?: string | null;
  service: string;
  startAt: Date;
  endAt: Date;
  totalPrice: number;
  pets: Array<{ species: string }>;
  sitter?: {
    firstName: string;
    lastName: string;
  };
}

export async function sendInitialBookingConfirmation(booking: Booking): Promise<boolean> {
  const petQuantities = formatPetsByQuantity(booking.pets);
  const message = `✅ Booking confirmed\n\nHi ${booking.firstName},\n\nYour ${booking.service} booking is confirmed for ${booking.startAt.toLocaleDateString()} at ${booking.startAt.toLocaleTimeString()}.\n\nPets: ${petQuantities}\nTotal: $${booking.totalPrice.toFixed(2)}\n\nWe'll coordinate all updates in this same thread.`;
  
  return await sendDirectMessageOrFail("client", booking.phone, message);
}

export async function sendBookingConfirmedToClient(booking: Booking): Promise<boolean> {
  const petQuantities = formatPetsByQuantity(booking.pets);
  const message = `✅ Booking confirmed\n\nHi ${booking.firstName},\n\nYour ${booking.service} booking is confirmed for ${booking.startAt.toLocaleDateString()} at ${booking.startAt.toLocaleTimeString()}.\n\nPets: ${petQuantities}\nTotal: $${booking.totalPrice.toFixed(2)}\n\nWe'll coordinate all updates in this same thread.`;
  
  return await sendDirectMessageOrFail("client", booking.phone, message);
}

export async function sendClientNightBeforeReminder(booking: Booking): Promise<boolean> {
  const petQuantities = formatPetsByQuantity(booking.pets);
  const message = `🌙 REMINDER!\n\nHi ${booking.firstName},\n\nJust a friendly reminder about your ${booking.service} appointment tomorrow at ${booking.startAt.toLocaleTimeString()}.\n\nPets: ${petQuantities}\n\nWe're excited to care for your pets!`;
  
  return await sendDirectMessageOrFail("client", booking.phone, message);
}

export async function sendSitterNightBeforeReminder(booking: Booking, sitterId?: string): Promise<boolean> {
  const petQuantities = formatPetsByQuantity(booking.pets);
  
  // Calculate sitter earnings if sitterId is provided
  let earningsText = '';
  if (sitterId && booking.totalPrice) {
    const { prisma } = await import("@/lib/db");
    const sitter = booking.orgId
      ? await (prisma as any).sitter.findFirst({ where: { id: sitterId, orgId: booking.orgId } })
      : await prisma.sitter.findUnique({ where: { id: sitterId } });
    if (sitter && booking.totalPrice) {
      // Note: Sitter model doesn't have commissionPercentage field
      // Use default 80% commission
      const commissionPercentage = 80.0;
      const earnings = (booking.totalPrice * commissionPercentage) / 100;
      earningsText = `\nYour Earnings: $${earnings.toFixed(2)}`;
    }
  }

  const clientName = formatClientNameForSitter(booking.firstName, booking.lastName);
  const message = `🌙 REMINDER!\n\nHi,\n\nYou have a ${booking.service} appointment tomorrow at ${booking.startAt.toLocaleTimeString()}.\n\nClient: ${clientName}\nPets: ${petQuantities}\nAddress: ${booking.address}${earningsText}\n\nPlease confirm your availability.`;

  let sitterPhone: string | null = null;
  if (sitterId) {
    sitterPhone = await getSitterPhone(sitterId, booking.orgId, "nightBeforeReminder");
  }
  
  if (!sitterPhone) {
    console.error("Sitter phone number not found");
    return false;
  }
  
  return await sendDirectMessageOrFail("sitter", sitterPhone, message);
}

export async function sendPostVisitThankYou(booking: Booking): Promise<boolean> {
  const petQuantities = formatPetsByQuantity(booking.pets);
  const message = `🐾 THANK YOU!\n\nHi ${booking.firstName},\n\nThank you for choosing Snout Services! We hope your pets enjoyed their ${booking.service.toLowerCase()}.\n\nPets: ${petQuantities}\n\nWe look forward to caring for your pets again soon!`;
  
  return await sendDirectMessageOrFail("client", booking.phone, message);
}

export async function sendSitterAssignmentNotification(booking: Booking, sitterId?: string): Promise<boolean> {
  const petQuantities = formatPetsByQuantity(booking.pets);
  
  // Calculate sitter earnings if sitterId is provided
  let earningsText = '';
  if (sitterId && booking.totalPrice) {
    const { prisma } = await import("@/lib/db");
    const sitter = booking.orgId
      ? await (prisma as any).sitter.findFirst({ where: { id: sitterId, orgId: booking.orgId } })
      : await prisma.sitter.findUnique({ where: { id: sitterId } });
    if (sitter && booking.totalPrice) {
      // Note: Sitter model doesn't have commissionPercentage field
      // Use default 80% commission
      const commissionPercentage = 80.0;
      const earnings = (booking.totalPrice * commissionPercentage) / 100;
      earningsText = `\nYour Earnings: $${earnings.toFixed(2)}`;
    }
  }

  const clientName = formatClientNameForSitter(booking.firstName, booking.lastName);
  const message = `✅ New assignment\n\nHi,\n\nYou've been assigned to ${clientName}'s ${booking.service} booking on ${booking.startAt.toLocaleDateString()} at ${booking.startAt.toLocaleTimeString()}.\n\nPets: ${petQuantities}\nAddress: ${booking.address}${earningsText}\n\nPlease use this thread for visit-related updates only.`;

  let sitterPhone: string | null = null;
  if (sitterId) {
    sitterPhone = await getSitterPhone(sitterId, booking.orgId, "sitterAssignment");
  }
  
  if (!sitterPhone) {
    console.error("Sitter phone number not found");
    return false;
  }
  
  return await sendDirectMessageOrFail("sitter", sitterPhone, message);
}

export async function sendReportToClient(booking: Booking, reportContent: string): Promise<boolean> {
  const petQuantities = formatPetsByQuantity(booking.pets);
  const message = `🐾 VISIT REPORT\n\nHi ${booking.firstName},\n\nYour ${booking.service} visit has been completed!\n\nPets: ${petQuantities}\nSitter: ${booking.sitter?.firstName || 'Assigned sitter'}\n\nReport: ${reportContent}\n\nThank you for choosing Snout Services!`;
  
  return await sendDirectMessageOrFail("client", booking.phone, message);
}

export async function sendOwnerAlert(
  firstName: string,
  lastName: string,
  phone: string,
  service: string,
  startAt: Date,
  pets: Array<{ species: string }>
): Promise<boolean> {
  const petQuantities = formatPetsByQuantity(pets);
  const message = `📱 NEW BOOKING ALERT\n\n${firstName} ${lastName} - ${service}\nDate: ${startAt.toLocaleDateString()} at ${startAt.toLocaleTimeString()}\nPets: ${petQuantities}\nPhone: ${phone}`;
  
  const ownerPhone = await getOwnerPhone(undefined, "ownerNewBookingAlert");
  if (!ownerPhone) {
    console.error("Owner phone number not configured");
    return false;
  }
  
  return await sendDirectMessageOrFail("owner", ownerPhone, message);
}

export async function sendPaymentReminder(booking: Booking, paymentLink: string): Promise<boolean> {
  const petQuantities = formatPetsByQuantity(booking.pets);
  const message = `💳 PAYMENT REMINDER\n\nHi ${booking.firstName},\n\nYour ${booking.service} booking on ${booking.startAt.toLocaleDateString()} is ready for payment.\n\nPets: ${petQuantities}\nTotal: $${booking.totalPrice.toFixed(2)}\n\nPay now: ${paymentLink}`;
  
  return await sendDirectMessageOrFail("client", booking.phone, message);
}