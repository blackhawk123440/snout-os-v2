/**
 * Automation Executor
 * 
 * Executes automation logic for a specific automation type and recipient.
 * This is called by the automation worker after jobs are enqueued.
 * 
 * Per Master Spec Line 6.2.3: Each automation run writes an EventLog record
 */

import { prisma } from "./db";
import { shouldSendToRecipient, getMessageTemplate, replaceTemplateVariables } from "./automation-utils";
import { sendMessage } from "./message-utils";
import { logEventFromLogger } from "./event-logger";
import { getOwnerPhone, getSitterPhone } from "./phone-utils";
import { sendAutomationMessageViaThread } from "./bookings/automation-thread-sender";
import { notifyOwnerPersonalPhone } from "./automation-owner-notify";
import { onBookingConfirmed } from "./bookings/booking-confirmed-handler";
import { redactPhoneNumber } from "./messaging/logging-helpers";
import {
  formatDatesAndTimesForMessage,
  formatDateForMessage,
  formatTimeForMessage,
  formatClientNameForSitter,
  formatPetsByQuantity,
  calculatePriceBreakdown
} from "./booking-utils";

function formatPetNames(pets: Array<{ name?: string | null }> | null | undefined): string {
  if (!pets || pets.length === 0) return 'your pet';
  const names = pets.map(p => p.name).filter(Boolean);
  if (names.length === 0) return 'your pet';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
}

export interface AutomationContext {
  bookingId?: string;
  sitterId?: string;
  [key: string]: any;
}

export interface AutomationResult {
  success: boolean;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}

function redactedPhone(phone: string | null | undefined): string {
  return redactPhoneNumber(phone);
}

/**
 * Resolve orgId from context (for settings/template lookup). Uses context.orgId or minimal booking lookup.
 */
async function resolveOrgId(context: AutomationContext): Promise<string> {
  if (context.orgId && typeof context.orgId === "string") return context.orgId;
  if (context.bookingId) {
    // This initial lookup is the one case where we don't have orgId yet —
    // we're resolving it FROM the booking. UUID collision risk is negligible.
    const row = await prisma.booking.findUnique({
      where: { id: context.bookingId },
      select: { orgId: true },
    });
    if (row?.orgId) return row.orgId;
  }
  return "default";
}

/**
 * Execute an automation for a specific recipient
 */
export async function executeAutomationForRecipient(
  automationType: string,
  recipient: "client" | "sitter" | "owner",
  context: AutomationContext
): Promise<AutomationResult> {
  const orgId = await resolveOrgId(context);
  const shouldSend = await shouldSendToRecipient(automationType, recipient, orgId);
  if (!shouldSend) {
    return {
      success: true,
      message: `Automation ${automationType} skipped for ${recipient} (disabled in settings)`,
      metadata: { skipped: true },
    };
  }

  let booking: any = null;
  if (context.bookingId) {
    booking = await (prisma as any).booking.findFirst({
      where: { id: context.bookingId, orgId },
      include: {
        pets: true,
        timeSlots: true,
        sitter: true,
        client: true,
      },
    });
    if (!booking) {
      return {
        success: false,
        error: `Booking not found: ${context.bookingId}`,
      };
    }
  }

  // All automation types require a booking. Guard here so handlers never receive null.
  if (!booking) {
    return {
      success: false,
      error: `Booking required for automation ${automationType} but none found (bookingId: ${context.bookingId ?? 'missing'})`,
    };
  }

  // Execute based on automation type and recipient
  try {
    switch (automationType) {
      case "ownerNewBookingAlert":
        return await executeOwnerNewBookingAlert(recipient, context, booking);

      case "bookingConfirmation":
        return await executeBookingConfirmation(recipient, context, booking);

      case "nightBeforeReminder":
        return await executeNightBeforeReminder(recipient, context, booking);

      case "sitterAssignment":
        return await executeSitterAssignment(recipient, context, booking);

      case "paymentReminder":
        return await executePaymentReminder(recipient, context, booking);

      case "postVisitThankYou":
        return await executePostVisitThankYou(recipient, context, booking);

      case "checkinNotification":
        return await executeCheckinNotification(recipient, context, booking);

      case "checkoutNotification":
        return await executeCheckoutNotification(recipient, context, booking);

      case "bookingCancellation":
        return await executeBookingCancellation(recipient, context, booking);

      case "visitReportNotification":
        return await executeVisitReportNotification(recipient, context, booking);

      case "onMyWay":
        return await executeOnMyWay(recipient, context, booking);

      default:
        return {
          success: false,
          error: `Unknown automation type: ${automationType}`,
        };
    }
  } catch (handlerError) {
    // Re-throw so BullMQ retries on transient errors (DB down, network failure).
    // The worker's "failed" handler logs to Sentry and dead-letters after max attempts.
    throw handlerError;
  }
}

/**
 * Execute owner new booking alert
 */
async function executeOwnerNewBookingAlert(
  recipient: "client" | "sitter" | "owner",
  context: AutomationContext,
  booking: any
): Promise<AutomationResult> {
  if (!booking) {
    return { success: false, error: "Booking required for ownerNewBookingAlert" };
  }

  if (recipient === "client") {
    const petQuantities = formatPetsByQuantity(booking.pets);
    const formattedDatesTimes = formatDatesAndTimesForMessage({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timeSlots: booking.timeSlots || [],
    });

    const orgIdNewBooking = booking.orgId || "default";
    let template = await getMessageTemplate("ownerNewBookingAlert", "client", orgIdNewBooking);
    if (!template || template.trim() === "") {
      template = "🐾 Booking received!\n\nHi {{firstName}},\n\nThanks for choosing Snout for {{petNames}}! We've received your {{service}} request for:\n📅 {{datesTimes}}\n🐕 {{petQuantities}}\n\nWe'll confirm details shortly in this same thread.";
    }

    const message = replaceTemplateVariables(template, {
      firstName: booking.firstName,
      service: booking.service,
      datesTimes: formattedDatesTimes,
      date: formatDateForMessage(booking.startAt),
      time: formatTimeForMessage(booking.startAt),
      petQuantities,
      petNames: formatPetNames(booking.pets),
    });

    // Phase 3: Send via thread masking number
    const orgId = orgIdNewBooking;
    const result = await sendAutomationMessageViaThread({
      bookingId: booking.id,
      orgId,
      clientId: booking.clientId || '',
      message,
      recipient: 'client',
    });
    
    if (!result.success && result.usedThread === false) {
      // Thread not found - log audit warning
      // Note: eventLog model doesn't exist in enterprise-messaging-dashboard schema
      console.warn('[Automation] Thread not found, using fallback', {
        eventType: 'automation.fallback',
        status: 'warning',
        bookingId: booking.id,
        error: 'Thread not found, used fallback sendMessage',
        automationType: 'ownerNewBookingAlert',
        recipient: 'client',
        reason: 'Thread not found for booking',
      });
    }
    
    return {
      success: result.success,
      message: result.success ? "Client notification sent" : result.error || "Failed to send client notification",
      metadata: { recipient: "client", phone: redactedPhone(booking.phone), usedThread: result.usedThread },
    };
  }

  if (recipient === "owner") {
    const ownerPhone = await getOwnerPhone(undefined, "ownerNewBookingAlert", booking.orgId || "default");
    if (!ownerPhone) {
      return { success: false, error: "Owner phone not found" };
    }

    const petQuantities = formatPetsByQuantity(booking.pets);
    const formattedDatesTimes = formatDatesAndTimesForMessage({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timeSlots: booking.timeSlots || [],
    });

    const bookingDetailsUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/bookings?booking=${booking.id}`;

    const orgIdOwner = booking.orgId || "default";
    let template = await getMessageTemplate("ownerNewBookingAlert", "owner", orgIdOwner);
    if (!template || template.trim() === "") {
      template = "📱 NEW BOOKING!\n\n{{firstName}} {{lastName}}\n{{phone}}\n\n{{service}}\n{{datesTimes}}\n{{petQuantities}}\nTotal: ${{totalPrice}}\n\nView details: {{bookingUrl}}";
    }

    const breakdown = calculatePriceBreakdown({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      pets: booking.pets || [],
      quantity: booking.quantity || 1,
      afterHours: booking.afterHours || false,
      holiday: booking.holiday || false,
      timeSlots: booking.timeSlots || [],
    });

    const message = replaceTemplateVariables(template, {
      firstName: booking.firstName,
      lastName: booking.lastName,
      phone: booking.phone,
      service: booking.service,
      datesTimes: formattedDatesTimes,
      date: formatDateForMessage(booking.startAt),
      time: formatTimeForMessage(booking.startAt),
      petQuantities,
      totalPrice: breakdown.total.toFixed(2),
      bookingUrl: bookingDetailsUrl,
    });

    // Phase 3: Owner notifications don't use thread (no booking context for owner)
    // Keep old sendMessage for owner notifications
    const sent = await sendMessage(ownerPhone, message, booking.id);
    
    return {
      success: sent,
      message: sent ? "Owner notification sent" : "Failed to send owner notification",
      metadata: { recipient: "owner", phone: redactedPhone(ownerPhone) },
    };
  }

  return { success: false, error: `Unsupported recipient for ownerNewBookingAlert: ${recipient}` };
}

/**
 * Execute booking confirmation
 * Phase 3.4: Implemented - sends confirmation message when booking is confirmed
 */
async function executeBookingConfirmation(
  recipient: "client" | "sitter" | "owner",
  context: AutomationContext,
  booking: any
): Promise<AutomationResult> {
  if (!booking) {
    return { success: false, error: "Booking required for bookingConfirmation" };
  }

  if (recipient === "client") {
    const petQuantities = formatPetsByQuantity(booking.pets);
    const formattedDatesTimes = formatDatesAndTimesForMessage({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timeSlots: booking.timeSlots || [],
    });

    const orgIdBc = booking.orgId || "default";
    let template = await getMessageTemplate("bookingConfirmation", "client", orgIdBc);
    if (!template || template.trim() === "") {
      template = "✅ Confirmed!\n\nHi {{firstName}}, we're confirmed for {{petNames}}'s {{service}}!\n\n📅 {{datesTimes}}\n🐕 {{petQuantities}}\n💰 ${{totalPrice}}\n\nWe'll coordinate any updates right here.";
    }

    const breakdown = calculatePriceBreakdown({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      pets: booking.pets || [],
      quantity: booking.quantity || 1,
      afterHours: booking.afterHours || false,
      holiday: booking.holiday || false,
      timeSlots: booking.timeSlots || [],
    });

    const message = replaceTemplateVariables(template, {
      firstName: booking.firstName,
      service: booking.service,
      datesTimes: formattedDatesTimes,
      date: formatDateForMessage(booking.startAt),
      time: formatTimeForMessage(booking.startAt),
      petQuantities,
      petNames: formatPetNames(booking.pets),
      totalPrice: breakdown.total.toFixed(2),
      total: breakdown.total.toFixed(2),
    });

    // Phase 3: Send via thread masking number
    const orgId = orgIdBc;
    const result = await sendAutomationMessageViaThread({
      bookingId: booking.id,
      orgId,
      clientId: booking.clientId || '',
      message,
      recipient: 'client',
    });
    
    const sent = result.success;
    
    return {
      success: sent,
      message: sent ? "Booking confirmation sent to client" : result.error || "Failed to send booking confirmation",
      metadata: { 
        recipient: "client", 
        phone: redactedPhone(booking.phone),
        usedThread: result.usedThread || false,
      },
    };
  }

  // Owner notifications for booking confirmation are optional
  if (recipient === "owner") {
    const ownerPhone = await getOwnerPhone(undefined, "bookingConfirmation", booking.orgId || "default");
    if (!ownerPhone) {
      return { success: false, error: "Owner phone not found" };
    }

    const orgIdBcOwner = booking.orgId || "default";
    let template = await getMessageTemplate("bookingConfirmation", "owner", orgIdBcOwner);
    if (!template || template.trim() === "") {
      template = "✅ BOOKING CONFIRMED\n\n{{firstName}} {{lastName}}'s {{service}} booking has been confirmed.\n\n{{datesTimes}}";
    }

    const formattedDatesTimes = formatDatesAndTimesForMessage({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timeSlots: booking.timeSlots || [],
    });

    const message = replaceTemplateVariables(template, {
      firstName: booking.firstName,
      lastName: booking.lastName,
      service: booking.service,
      datesTimes: formattedDatesTimes,
      date: formatDateForMessage(booking.startAt),
      time: formatTimeForMessage(booking.startAt),
    });

    const sent = await sendMessage(ownerPhone, message, booking.id);
    
    return {
      success: sent,
      message: sent ? "Booking confirmation notification sent to owner" : "Failed to send owner notification",
      metadata: { recipient: "owner", phone: redactedPhone(ownerPhone) },
    };
  }

  return { success: false, error: `Unsupported recipient for bookingConfirmation: ${recipient}` };
}

/**
 * Execute night before reminder
 * Phase 3.5: Implemented - sends reminder message to client or sitter the night before booking
 */
async function executeNightBeforeReminder(
  recipient: "client" | "sitter" | "owner",
  context: AutomationContext,
  booking: any
): Promise<AutomationResult> {
  if (!booking) {
    return { success: false, error: "Booking required for nightBeforeReminder" };
  }

  const orgId = booking.orgId || "default";

  // Skip if booking cancelled
  if (booking.status === "cancelled") {
    await logEventFromLogger("reminder.failed", "skipped", {
      orgId,
      bookingId: booking.id,
      metadata: { recipient, reason: "booking_cancelled" },
    });
    return {
      success: true,
      message: "Night before reminder skipped (booking cancelled)",
      metadata: { skipped: true, reason: "cancelled" },
    };
  }

  // Skip if email is required but missing (for client reminders)
  if (recipient === "client" && !booking.email) {
    return {
      success: true,
      message: "Night before reminder skipped for client (no email)",
      metadata: { skipped: true, reason: "no_email" },
    };
  }

  let targetPhone: string | null = null;
  let template: string | null = null;
  let isSitterMessage = false;

  const orgIdReminder = booking.orgId || "default";
  if (recipient === "client") {
    targetPhone = booking.phone;
    template = await getMessageTemplate("nightBeforeReminder", "client", orgIdReminder);
    if (!template || template.trim() === "") {
      template = "🌙 REMINDER!\n\nHi {{firstName}},\n\nJust a friendly reminder — {{petNames}}'s {{service}} is tomorrow!\n📅 {{datesTimes}}\n🐕 {{petQuantities}}\n\nWe're excited to care for {{petNames}}!";
    }
  } else if (recipient === "sitter" && booking.sitterId) {
    targetPhone = await getSitterPhone(booking.sitterId, orgIdReminder, "nightBeforeReminder");
    if (!targetPhone) {
      return { success: false, error: "Sitter phone not found for nightBeforeReminder" };
    }
    template = await getMessageTemplate("nightBeforeReminder", "sitter", orgIdReminder);
    if (!template || template.trim() === "") {
      template = "🌙 REMINDER!\n\nHi {{sitterFirstName}},\n\nYou have a {{service}} appointment:\n{{datesTimes}}\n\nClient: {{clientName}}\nPets: {{petQuantities}}\nAddress: {{address}}\nYour Earnings: ${{earnings}}\n\nPlease confirm your availability.";
    }
    isSitterMessage = true;
  } else if (recipient === "owner") {
    // Owner reminders not typically sent for night before, but handle if needed
    targetPhone = await getOwnerPhone(undefined, "nightBeforeReminder", booking.orgId || "default");
    if (!targetPhone) {
      return { success: false, error: "Owner phone not found for nightBeforeReminder" };
    }
    template = await getMessageTemplate("nightBeforeReminder", "owner", orgIdReminder);
    if (!template || template.trim() === "") {
      template = "🌙 REMINDER!\n\nReminder: {{clientName}} has a {{service}} appointment tomorrow:\n{{datesTimes}}\n\nPets: {{petQuantities}}";
    }
  } else {
    return { success: false, error: `Unsupported recipient or missing sitterId for nightBeforeReminder: ${recipient}` };
  }

  if (!targetPhone) {
    return { success: false, error: `No phone number found for ${recipient} for nightBeforeReminder` };
  }

  // Build template variables
  const petQuantities = formatPetsByQuantity(booking.pets);
  const formattedDatesTimes = formatDatesAndTimesForMessage({
    service: booking.service,
    startAt: booking.startAt,
    endAt: booking.endAt,
    timeSlots: booking.timeSlots || [],
  });

  let variables: Record<string, string | number> = {
    firstName: booking.firstName,
    lastName: booking.lastName,
    service: booking.service,
    datesTimes: formattedDatesTimes,
    date: formatDateForMessage(booking.startAt),
    time: formatTimeForMessage(booking.startAt),
    petQuantities,
    petNames: formatPetNames(booking.pets),
  };

  if (isSitterMessage && booking.sitter) {
    const clientName = formatClientNameForSitter(booking.firstName, booking.lastName);
    const breakdown = calculatePriceBreakdown({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      pets: booking.pets || [],
      quantity: booking.quantity || 1,
      afterHours: booking.afterHours || false,
      holiday: booking.holiday || false,
      timeSlots: booking.timeSlots || [],
    });
    const commissionPercentage = booking.sitter.commissionPercentage || 80.0;
    const earnings = (breakdown.total * commissionPercentage) / 100;
    
    variables = {
      ...variables,
      sitterFirstName: booking.sitter.firstName,
      clientName,
      address: booking.address || "TBD",
      earnings: earnings.toFixed(2),
      totalPrice: breakdown.total.toFixed(2),
      total: breakdown.total.toFixed(2),
    };
  } else if (recipient === "owner") {
    variables.clientName = `${booking.firstName} ${booking.lastName}`;
  }

  const message = replaceTemplateVariables(template, variables, { 
    isSitterMessage,
    sitterCommissionPercentage: booking.sitter?.commissionPercentage || context.sitter?.commissionPercentage,
  });

  // Phase 3: Client reminders use thread, owner/sitter use old method
  if (recipient === 'client') {
    const orgId = booking.orgId || 'default';
    const result = await sendAutomationMessageViaThread({
      bookingId: booking.id,
      orgId,
      clientId: booking.clientId || '',
      message,
      recipient: 'client',
    });
    
    if (!result.success && result.usedThread === false) {
      // Thread not found - log audit warning
      // Note: eventLog model doesn't exist in enterprise-messaging-dashboard schema
      console.warn('[Automation] Thread not found, using fallback', {
        eventType: 'automation.fallback',
        status: 'warning',
        bookingId: booking.id,
        error: 'Thread not found, used fallback sendMessage',
        automationType: 'nightBeforeReminder',
        recipient: 'client',
        reason: 'Thread not found for booking',
      });
    }
    
    if (result.success) {
      await logEventFromLogger("reminder.sent", "success", {
        orgId,
        bookingId: booking.id,
        metadata: { recipient },
      });
    } else {
      await logEventFromLogger("reminder.failed", "failed", {
        orgId,
        bookingId: booking.id,
        error: result.error,
        metadata: { recipient },
      });
    }
    return {
      success: result.success,
      message: result.success ? `${recipient} reminder sent` : result.error || `Failed to send ${recipient} reminder`,
      metadata: { recipient, phone: redactedPhone(targetPhone), bookingId: booking.id, usedThread: result.usedThread },
    };
  }

  // Owner/sitter reminders use old method
  const sent = await sendMessage(targetPhone, message, booking.id);

  if (sent) {
    await logEventFromLogger("reminder.sent", "success", {
      orgId,
      bookingId: booking.id,
      metadata: { recipient },
    });
  } else {
    await logEventFromLogger("reminder.failed", "failed", {
      orgId,
      bookingId: booking.id,
      metadata: { recipient },
    });
  }

  return {
    success: sent,
    message: sent ? `${recipient} reminder sent` : `Failed to send ${recipient} reminder`,
    metadata: { recipient, phone: redactedPhone(targetPhone), bookingId: booking.id },
  };
}

/**
 * Execute sitter assignment notification
 * Phase 3.4: Implemented - sends notification when sitter is assigned to booking
 */
async function executeSitterAssignment(
  recipient: "client" | "sitter" | "owner",
  context: AutomationContext,
  booking: any
): Promise<AutomationResult> {
  if (!booking) {
    return { success: false, error: "Booking required for sitterAssignment" };
  }

  if (!booking.sitterId && !context.sitterId) {
    return { success: false, error: "Sitter ID required for sitterAssignment" };
  }

  const sitterId = booking.sitterId || context.sitterId;
  // Note: Sitter query disabled - booking model not available in messaging schema
  const sitter = booking.sitter || null;

  if (!sitter) {
    return { success: false, error: `Sitter not found: ${sitterId}` };
  }

  if (recipient === "sitter") {
    const sitterPhone = await getSitterPhone(sitterId, booking.orgId || "default", "sitterAssignment");
    if (!sitterPhone) {
      return { success: false, error: "Sitter phone not found" };
    }

    const petQuantities = formatPetsByQuantity(booking.pets);
    const formattedDatesTimes = formatDatesAndTimesForMessage({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timeSlots: booking.timeSlots || [],
    });

    const clientName = formatClientNameForSitter(booking.firstName, booking.lastName);
    const orgIdAssign = booking.orgId || "default";

    let template = await getMessageTemplate("sitterAssignment", "sitter", orgIdAssign);
    if (!template || template.trim() === "") {
      template = "✅ New assignment\n\nYou are assigned to a {{service}} visit.\n\nClient: {{clientName}}\n{{datesTimes}}\nPets: {{petQuantities}}\nAddress: {{address}}\n\nUse this thread for visit-related updates only.";
    }

    const breakdown = calculatePriceBreakdown({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      pets: booking.pets || [],
      quantity: booking.quantity || 1,
      afterHours: booking.afterHours || false,
      holiday: booking.holiday || false,
      timeSlots: booking.timeSlots || [],
    });

    const message = replaceTemplateVariables(template, {
      clientName,
      firstName: booking.firstName,
      lastName: booking.lastName,
      service: booking.service,
      datesTimes: formattedDatesTimes,
      date: formatDateForMessage(booking.startAt),
      time: formatTimeForMessage(booking.startAt),
      petQuantities,
      address: booking.address || "Address not provided",
      totalPrice: breakdown.total.toFixed(2),
      total: breakdown.total.toFixed(2),
      sitterName: `${sitter.firstName} ${sitter.lastName}`,
    }, {
      isSitterMessage: true,
      sitterCommissionPercentage: sitter.commissionPercentage || 80,
    });

    // Phase 3: Sitter notifications don't use thread (no booking context for sitter)
    // Keep old sendMessage for sitter notifications
    const sent = await sendMessage(sitterPhone, message, booking.id);
    
    return {
      success: sent,
      message: sent ? "Sitter assignment notification sent" : "Failed to send sitter notification",
      metadata: { recipient: "sitter", phone: redactedPhone(sitterPhone), sitterId },
    };
  }

  if (recipient === "client") {
    const orgIdAssignClient = booking.orgId || "default";
    const petQuantities = formatPetsByQuantity(booking.pets);
    const formattedDatesTimes = formatDatesAndTimesForMessage({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timeSlots: booking.timeSlots || [],
    });

    let template = await getMessageTemplate("sitterAssignment", "client", orgIdAssignClient);
    if (!template || template.trim() === "") {
      template = "🐾 Your care team is set\n\nHi {{firstName}},\n\nWe've assigned your sitter for {{service}}:\n\nSitter: {{sitterName}}\n{{datesTimes}}\n\nPets: {{petQuantities}}\n\nWe'll coordinate meet-and-greet and service updates here.";
    }

    const message = replaceTemplateVariables(template, {
      firstName: booking.firstName,
      service: booking.service,
      datesTimes: formattedDatesTimes,
      date: formatDateForMessage(booking.startAt),
      time: formatTimeForMessage(booking.startAt),
      petQuantities,
      sitterName: `${sitter.firstName} ${sitter.lastName}`,
    });

    // Phase 3: Send via thread masking number
    const orgId = booking.orgId || 'default';
    const result = await sendAutomationMessageViaThread({
      bookingId: booking.id,
      orgId,
      clientId: booking.clientId || '',
      message,
      recipient: 'client',
    });
    
    if (!result.success && result.usedThread === false) {
      // Thread not found - try to create it first, then send
      try {
        await onBookingConfirmed({
          bookingId: booking.id,
          orgId,
          clientId: booking.clientId || '',
          sitterId: booking.sitterId,
          startAt: new Date(booking.startAt),
          endAt: new Date(booking.endAt),
          actorUserId: 'system',
        });
        
        // Retry sending
        const retryResult = await sendAutomationMessageViaThread({
          bookingId: booking.id,
          orgId,
          clientId: booking.clientId || '',
          message,
          recipient: 'client',
        });
        
        return {
          success: retryResult.success,
          message: retryResult.success ? "Sitter assignment notification sent to client" : retryResult.error || "Failed to send client notification",
          metadata: { recipient: "client", phone: redactedPhone(booking.phone), usedThread: retryResult.usedThread },
        };
      } catch (error: any) {
        // Log audit warning
        // Note: eventLog model doesn't exist in enterprise-messaging-dashboard schema
        console.warn('[Automation] Thread creation failed', {
          eventType: 'automation.fallback',
          status: 'warning',
          bookingId: booking.id,
          error: `Thread creation failed: ${error.message}`,
          automationType: 'sitterAssignment',
          recipient: 'client',
          reason: 'Thread creation failed',
        });
      }
    }
    
    return {
      success: result.success,
      message: result.success ? "Sitter assignment notification sent to client" : result.error || "Failed to send client notification",
      metadata: { recipient: "client", phone: redactedPhone(booking.phone), usedThread: result.usedThread },
    };
  }

  return { success: false, error: `Unsupported recipient for sitterAssignment: ${recipient}` };
}

/**
 * Execute payment reminder
 * Phase 3.4: Implemented - sends payment reminder message to client
 */
async function executePaymentReminder(
  recipient: "client" | "sitter" | "owner",
  context: AutomationContext,
  booking: any
): Promise<AutomationResult> {
  if (!booking) {
    return { success: false, error: "Booking required for paymentReminder" };
  }

  if (recipient === "client") {
    // Skip if payment is already paid
    if (booking.paymentStatus === "paid") {
      return {
        success: true,
        message: "Payment reminder skipped - booking already paid",
        metadata: { skipped: true, reason: "already_paid" },
      };
    }

    const petQuantities = formatPetsByQuantity(booking.pets);
    const formattedDatesTimes = formatDatesAndTimesForMessage({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timeSlots: booking.timeSlots || [],
    });

    const orgIdPay = booking.orgId || "default";
    let template = await getMessageTemplate("paymentReminder", "client", orgIdPay);
    if (!template || template.trim() === "") {
      template = "💳 PAYMENT REMINDER\n\nHi {{firstName}},\n\nYour {{service}} booking is ready for payment.\n\n{{datesTimes}}\nPets: {{petQuantities}}\nTotal: ${{totalPrice}}\n\n{{paymentLink}}";
    }

    const breakdown = calculatePriceBreakdown({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      pets: booking.pets || [],
      quantity: booking.quantity || 1,
      afterHours: booking.afterHours || false,
      holiday: booking.holiday || false,
      timeSlots: booking.timeSlots || [],
    });

    // Get payment link if available
    const paymentLink = booking.stripePaymentLinkUrl || "";

    const message = replaceTemplateVariables(template, {
      firstName: booking.firstName,
      service: booking.service,
      datesTimes: formattedDatesTimes,
      date: formatDateForMessage(booking.startAt),
      time: formatTimeForMessage(booking.startAt),
      petQuantities,
      totalPrice: breakdown.total.toFixed(2),
      total: breakdown.total.toFixed(2),
      paymentLink: paymentLink || "Payment link will be sent separately",
    });

    // Phase 3: Send via thread masking number
    const orgId = orgIdPay;
    const result = await sendAutomationMessageViaThread({
      bookingId: booking.id,
      orgId,
      clientId: booking.clientId || '',
      message,
      recipient: 'client',
    });
    
    if (!result.success && result.usedThread === false) {
      // Thread not found - log audit warning
      // Note: eventLog model doesn't exist in enterprise-messaging-dashboard schema
      console.warn('[Automation] Thread not found, using fallback', {
        eventType: 'automation.fallback',
        status: 'warning',
        bookingId: booking.id,
        error: 'Thread not found, used fallback sendMessage',
        automationType: 'paymentReminder',
        recipient: 'client',
        reason: 'Thread not found for booking',
      });
    }
    
    return {
      success: result.success,
      message: result.success ? "Payment reminder sent to client" : result.error || "Failed to send payment reminder",
      metadata: { recipient: "client", phone: redactedPhone(booking.phone), paymentLink: paymentLink || null, usedThread: result.usedThread },
    };
  }

  // Owner notifications for payment reminders are optional
  if (recipient === "owner") {
    const ownerPhone = await getOwnerPhone(undefined, "paymentReminder", booking.orgId || "default");
    if (!ownerPhone) {
      return { success: false, error: "Owner phone not found" };
    }

    const orgIdPayOwner = booking.orgId || "default";
    let template = await getMessageTemplate("paymentReminder", "owner", orgIdPayOwner);
    if (!template || template.trim() === "") {
      template = "💳 PAYMENT REMINDER\n\n{{firstName}} {{lastName}}'s {{service}} booking requires payment.\n\n{{datesTimes}}\nTotal: ${{totalPrice}}\nStatus: {{paymentStatus}}";
    }

    const formattedDatesTimes = formatDatesAndTimesForMessage({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timeSlots: booking.timeSlots || [],
    });

    const breakdown = calculatePriceBreakdown({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      pets: booking.pets || [],
      quantity: booking.quantity || 1,
      afterHours: booking.afterHours || false,
      holiday: booking.holiday || false,
      timeSlots: booking.timeSlots || [],
    });

    const message = replaceTemplateVariables(template, {
      firstName: booking.firstName,
      lastName: booking.lastName,
      service: booking.service,
      datesTimes: formattedDatesTimes,
      date: formatDateForMessage(booking.startAt),
      time: formatTimeForMessage(booking.startAt),
      totalPrice: breakdown.total.toFixed(2),
      total: breakdown.total.toFixed(2),
      paymentStatus: booking.paymentStatus || "unpaid",
    });

    const sent = await sendMessage(ownerPhone, message, booking.id);
    
    return {
      success: sent,
      message: sent ? "Payment reminder notification sent to owner" : "Failed to send owner notification",
      metadata: { recipient: "owner", phone: redactedPhone(ownerPhone) },
    };
  }

  return { success: false, error: `Unsupported recipient for paymentReminder: ${recipient}` };
}

/**
 * Execute post visit thank you
 * Phase 3.4: Implemented - sends thank you message after visit completion
 */
async function executePostVisitThankYou(
  recipient: "client" | "sitter" | "owner",
  context: AutomationContext,
  booking: any
): Promise<AutomationResult> {
  if (!booking) {
    return { success: false, error: "Booking required for postVisitThankYou" };
  }

  // Only send to completed bookings
  if (booking.status !== "completed") {
    return {
      success: true,
      message: "Post visit thank you skipped - booking not completed",
      metadata: { skipped: true, reason: "not_completed", status: booking.status },
    };
  }

  if (recipient === "client") {
    const petQuantities = formatPetsByQuantity(booking.pets);
    const formattedDatesTimes = formatDatesAndTimesForMessage({
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timeSlots: booking.timeSlots || [],
    });

    const orgIdThankYou = booking.orgId || "default";
    let template = await getMessageTemplate("postVisitThankYou", "client", orgIdThankYou);
    if (!template || template.trim() === "") {
      template = "🐾 Thank you\n\nHi {{firstName}},\n\nThanks for trusting Snout with your {{service}} visit.\n\n{{datesTimes}}\nPets: {{petQuantities}}\n\nIf you'd like to book again, reply REBOOK in this thread and our team will help.";
    }

    const message = replaceTemplateVariables(template, {
      firstName: booking.firstName,
      service: booking.service.toLowerCase(),
      datesTimes: formattedDatesTimes,
      date: formatDateForMessage(booking.startAt),
      time: formatTimeForMessage(booking.startAt),
      petQuantities,
      sitterName: booking.sitter ? `${booking.sitter.firstName} ${booking.sitter.lastName}` : "your assigned sitter",
    });

    // Phase 3: Send via thread masking number
    const orgId = orgIdThankYou;
    const result = await sendAutomationMessageViaThread({
      bookingId: booking.id,
      orgId,
      clientId: booking.clientId || '',
      message,
      recipient: 'client',
    });
    
    if (!result.success && result.usedThread === false) {
      // Thread not found - log audit warning
      // Note: eventLog model doesn't exist in enterprise-messaging-dashboard schema
      console.warn('[Automation] Thread not found, using fallback', {
        eventType: 'automation.fallback',
        status: 'warning',
        bookingId: booking.id,
        error: 'Thread not found, used fallback sendMessage',
        automationType: 'postVisitThankYou',
        recipient: 'client',
        reason: 'Thread not found for booking',
      });
    }
    
    if (result.success) {
      await logEventFromLogger("review.sent", "success", {
        orgId,
        bookingId: booking.id,
        metadata: { recipient: "client" },
      });
    } else {
      await logEventFromLogger("review.failed", "failed", {
        orgId,
        bookingId: booking.id,
        error: result.error,
        metadata: { recipient: "client" },
      });
    }
    return {
      success: result.success,
      message: result.success ? "Post visit thank you sent to client" : result.error || "Failed to send post visit thank you",
      metadata: { recipient: "client", phone: redactedPhone(booking.phone), usedThread: result.usedThread },
    };
  }

  // Sitter thank you (optional)
  if (recipient === "sitter" && booking.sitterId) {
    const sitterPhone = await getSitterPhone(booking.sitterId, booking.orgId || "default", "postVisitThankYou");
    if (!sitterPhone) {
      return { success: false, error: "Sitter phone not found for postVisitThankYou" };
    }

    const clientName = formatClientNameForSitter(booking.firstName, booking.lastName);
    const petQuantities = formatPetsByQuantity(booking.pets);
    const orgIdThankYouSitter = booking.orgId || "default";

    let template = await getMessageTemplate("postVisitThankYou", "sitter", orgIdThankYouSitter);
    if (!template || template.trim() === "") {
      template = "🐾 GREAT JOB!\n\nHi,\n\nThank you for completing {{clientName}}'s {{service}} visit!\n\nPets: {{petQuantities}}\n\nYour professionalism makes all the difference!";
    }

    const message = replaceTemplateVariables(template, {
      clientName,
      service: booking.service.toLowerCase(),
      petQuantities,
    });

    const sent = await sendMessage(sitterPhone, message, booking.id);
    const orgId = orgIdThankYouSitter;
    if (sent) {
      await logEventFromLogger("review.sent", "success", {
        orgId,
        bookingId: booking.id,
        metadata: { recipient: "sitter" },
      });
    } else {
      await logEventFromLogger("review.failed", "failed", {
        orgId,
        bookingId: booking.id,
        metadata: { recipient: "sitter" },
      });
    }
    return {
      success: sent,
      message: sent ? "Post visit thank you sent to sitter" : "Failed to send sitter thank you",
      metadata: { recipient: "sitter", phone: redactedPhone(sitterPhone), sitterId: booking.sitterId },
    };
  }

  // Owner notifications for post visit are typically not needed
  if (recipient === "owner") {
    return {
      success: true,
      message: "Post visit thank you skipped for owner (typically not needed)",
      metadata: { skipped: true, reason: "owner_not_needed" },
    };
  }

  return { success: false, error: `Unsupported recipient for postVisitThankYou: ${recipient}` };
}

// ─── Check-In Notification ─────────────────────────────────────────

async function executeCheckinNotification(
  recipient: string,
  context: AutomationContext,
  booking: any
): Promise<AutomationResult> {
  const orgId = context.orgId || booking.orgId || "default";
  const shouldSend = await shouldSendToRecipient("checkinNotification", recipient as any, orgId);
  if (!shouldSend) return { success: true, message: "Skipped — disabled for this recipient" };

  const sitterName = booking.sitter?.name || booking.sitter?.firstName || "your sitter";
  const clientName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Client";

  if (recipient === "client") {
    const defaultMsg = `Hi {{firstName}}, your sitter {{sitterName}} has started your {{service}} visit. We'll update you when it's complete!`;
    const template = await getMessageTemplate("checkinNotification", "client", orgId) || defaultMsg;
    const message = replaceTemplateVariables(template, { firstName: booking.firstName, sitterName, service: booking.service });
    const phone = booking.phone || booking.client?.phone;
    if (phone) await sendMessage(phone, message, booking.id);
    await notifyOwnerPersonalPhone({ bookingId: booking.id, message: `Sitter ${sitterName} checked in for ${booking.service} — ${clientName}`, automationType: "checkinNotification" });
    return { success: true, message: "Check-in notification sent to client" };
  }

  if (recipient === "owner") {
    const message = `Sitter ${sitterName} checked in for ${booking.service} — ${clientName}`;
    await notifyOwnerPersonalPhone({ bookingId: booking.id, message, automationType: "checkinNotification" });
    return { success: true, message: "Check-in notification sent to owner" };
  }

  return { success: true, message: "Skipped" };
}

// ─── Check-Out Notification ────────────────────────────────────────

async function executeCheckoutNotification(
  recipient: string,
  context: AutomationContext,
  booking: any
): Promise<AutomationResult> {
  const orgId = context.orgId || booking.orgId || "default";
  const shouldSend = await shouldSendToRecipient("checkoutNotification", recipient as any, orgId);
  if (!shouldSend) return { success: true, message: "Skipped — disabled for this recipient" };

  const sitterName = booking.sitter?.name || booking.sitter?.firstName || "your sitter";
  const clientName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Client";

  if (recipient === "client") {
    const defaultMsg = `Hi {{firstName}}, your {{service}} visit is complete! Your sitter {{sitterName}} has checked out. A visit report will follow shortly.`;
    const template = await getMessageTemplate("checkoutNotification", "client", orgId) || defaultMsg;
    const message = replaceTemplateVariables(template, { firstName: booking.firstName, sitterName, service: booking.service });
    const phone = booking.phone || booking.client?.phone;
    if (phone) await sendMessage(phone, message, booking.id);
    await notifyOwnerPersonalPhone({ bookingId: booking.id, message: `Visit complete: ${sitterName} checked out — ${booking.service} for ${clientName}`, automationType: "checkoutNotification" });
    return { success: true, message: "Check-out notification sent to client" };
  }

  if (recipient === "owner") {
    const message = `Visit complete: ${sitterName} checked out — ${booking.service} for ${clientName}`;
    await notifyOwnerPersonalPhone({ bookingId: booking.id, message, automationType: "checkoutNotification" });
    return { success: true, message: "Check-out notification sent to owner" };
  }

  return { success: true, message: "Skipped" };
}

// ─── Booking Cancellation ──────────────────────────────────────────

async function executeBookingCancellation(
  recipient: string,
  context: AutomationContext,
  booking: any
): Promise<AutomationResult> {
  const orgId = context.orgId || booking.orgId || "default";
  const shouldSend = await shouldSendToRecipient("bookingCancellation", recipient as any, orgId);
  if (!shouldSend) return { success: true, message: "Skipped — disabled for this recipient" };

  const clientName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Client";
  const dateStr = booking.startAt ? new Date(booking.startAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";

  if (recipient === "client") {
    const defaultMsg = `Hi {{firstName}}, your {{service}} booking on {{datesTimes}} has been cancelled. Please contact us if you have questions.`;
    const template = await getMessageTemplate("bookingCancellation", "client", orgId) || defaultMsg;
    const message = replaceTemplateVariables(template, { firstName: booking.firstName, service: booking.service, datesTimes: dateStr });
    const phone = booking.phone || booking.client?.phone;
    if (phone) await sendMessage(phone, message, booking.id);
    await notifyOwnerPersonalPhone({ bookingId: booking.id, message: `Booking cancelled: ${booking.service} for ${clientName} on ${dateStr}`, automationType: "bookingCancellation" });
    return { success: true, message: "Cancellation notification sent to client" };
  }

  if (recipient === "sitter") {
    const sitterPhone = await getSitterPhone(booking.sitterId, orgId);
    if (sitterPhone) {
      const message = `A booking has been cancelled: ${booking.service} for ${clientName} on ${dateStr}`;
      await sendMessage(sitterPhone, message, booking.id);
    }
    return { success: true, message: "Cancellation notification sent to sitter" };
  }

  if (recipient === "owner") {
    const message = `Booking cancelled: ${booking.service} for ${clientName} on ${dateStr}`;
    await notifyOwnerPersonalPhone({ bookingId: booking.id, message, automationType: "bookingCancellation" });
    return { success: true, message: "Cancellation notification sent to owner" };
  }

  return { success: true, message: "Skipped" };
}

// ─── Visit Report Notification ─────────────────────────────────────

async function executeOnMyWay(
  recipient: string,
  context: AutomationContext,
  booking: any
): Promise<AutomationResult> {
  if (recipient !== "client") {
    return { success: true, metadata: { skipped: true, reason: "onMyWay only for client" } };
  }
  if (!booking.clientId) {
    return { success: false, error: "Client ID not set on booking" };
  }

  const sitterName = booking.sitter
    ? `${booking.sitter.firstName} ${booking.sitter.lastName}`.trim()
    : "Your sitter";
  const petNames = formatPetNames(booking.pets);
  const arrivalTime = booking.startAt
    ? new Date(booking.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "soon";

  const message = `🚗 ${sitterName} is on the way to see ${petNames}! Expected arrival: approximately ${arrivalTime}.`;
  const orgId = context.orgId || booking.orgId || "default";

  try {
    const { sendAutomationMessageViaThread } = await import("@/lib/bookings/automation-thread-sender");
    const result = await sendAutomationMessageViaThread({
      bookingId: booking.id,
      orgId,
      clientId: booking.clientId,
      message,
      recipient: "client",
      emailSubject: `${sitterName} is on the way!`,
    });
    return { success: result.success, error: result.error };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to send on-my-way notification" };
  }
}

async function executeVisitReportNotification(
  recipient: string,
  context: AutomationContext,
  booking: any
): Promise<AutomationResult> {
  const orgId = context.orgId || booking.orgId || "default";
  const shouldSend = await shouldSendToRecipient("visitReportNotification", recipient as any, orgId);
  if (!shouldSend) return { success: true, message: "Skipped — disabled for this recipient" };

  if (recipient === "client") {
    const defaultMsg = `Hi {{firstName}}, your sitter has submitted a visit report for {{service}}. View it in your client portal!`;
    const template = await getMessageTemplate("visitReportNotification", "client", orgId) || defaultMsg;
    const message = replaceTemplateVariables(template, { firstName: booking.firstName, service: booking.service });
    const phone = booking.phone || booking.client?.phone;
    if (phone) await sendMessage(phone, message, booking.id);
    await notifyOwnerPersonalPhone({ bookingId: booking.id, message: `Visit report submitted for ${booking.service} — ${booking.firstName}`, automationType: "visitReportNotification" });
    return { success: true, message: "Visit report notification sent to client" };
  }

  return { success: true, message: "Skipped" };
}
