/**
 * Owner personal phone notification utility.
 * Sends a notification to the owner's personal phone with a booking link.
 * Called by every automation executor alongside the primary send.
 * Never throws — failures are logged but don't block the automation.
 */

import { sendMessage } from './message-utils';

export async function notifyOwnerPersonalPhone(params: {
  bookingId: string;
  message: string;
  automationType: string;
}): Promise<void> {
  const ownerPersonalPhone = process.env.OWNER_PERSONAL_PHONE;
  if (!ownerPersonalPhone) return;

  const appDomain =
    process.env.APP_DOMAIN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';
  const bookingLink = `${appDomain.replace(/\/$/, '')}/bookings/${params.bookingId}`;
  const fullMessage = `${params.message}\n\nView booking: ${bookingLink}`;

  try {
    await sendMessage(ownerPersonalPhone, fullMessage, params.bookingId);
  } catch (err) {
    console.error(`[owner-notify] Failed to send ${params.automationType}:`, err);
  }
}
