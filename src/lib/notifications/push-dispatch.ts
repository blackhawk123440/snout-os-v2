/**
 * Push notification dispatch for key events.
 * Called from existing notification triggers (fire-and-forget).
 *
 * Events covered:
 * 1. New message
 * 2. Visit started (sitter checked in)
 * 3. Report posted
 * 4. Offer received / assignment
 * 5. Replacement needed (callout)
 */

import { sendPushToClient, sendPushToSitter, sendPushToOwners, sendPushToUser, type PushCategory } from '@/lib/push';

// ─── 1. New message ─────────────────────────────────────────────────

export async function pushNewMessage(params: {
  recipientUserId?: string;
  recipientClientId?: string;
  recipientSitterId?: string;
  senderName: string;
  preview: string;
  threadUrl: string;
}) {
  try {
    const payload = {
      title: `Message from ${params.senderName}`,
      body: params.preview.slice(0, 100),
      url: params.threadUrl,
      tag: 'new-message',
      category: 'messages' as PushCategory,
    };

    if (params.recipientUserId) {
      await sendPushToUser(params.recipientUserId, payload);
    } else if (params.recipientClientId) {
      await sendPushToClient(params.recipientClientId, payload);
    } else if (params.recipientSitterId) {
      await sendPushToSitter(params.recipientSitterId, payload);
    }
  } catch (error) {
    console.error('[push-dispatch] newMessage failed:', error);
  }
}

// ─── 2. Visit started (sitter checked in) ───────────────────────────

export async function pushVisitStarted(params: {
  clientId: string;
  sitterName: string;
  petNames: string;
  bookingId: string;
}) {
  try {
    const petPart = params.petNames ? ` with ${params.petNames}` : '';
    await sendPushToClient(params.clientId, {
      title: 'Visit started',
      body: `${params.sitterName} has arrived${petPart}.`,
      url: `/client/bookings/${params.bookingId}`,
      tag: `visit-${params.bookingId}`,
      category: 'visitStarted',
    });
  } catch (error) {
    console.error('[push-dispatch] visitStarted failed:', error);
  }
}

// ─── 3. Report posted ───────────────────────────────────────────────

export async function pushReportPosted(params: {
  clientId: string;
  sitterName: string;
  petNames: string;
  reportId: string;
}) {
  try {
    const petPart = params.petNames ? ` for ${params.petNames}` : '';
    await sendPushToClient(params.clientId, {
      title: 'Visit report ready',
      body: `${params.sitterName} submitted a report${petPart}. See photos and details.`,
      url: `/client/reports/${params.reportId}`,
      tag: `report-${params.reportId}`,
      category: 'reports',
    });
  } catch (error) {
    console.error('[push-dispatch] reportPosted failed:', error);
  }
}

// ─── 4. Offer received / assignment ─────────────────────────────────

export async function pushSitterAssigned(params: {
  sitterId: string;
  clientName: string;
  service: string;
  date: string;
  bookingId: string;
}) {
  try {
    await sendPushToSitter(params.sitterId, {
      title: 'New assignment',
      body: `${params.service} for ${params.clientName} on ${params.date}`,
      url: `/sitter/bookings/${params.bookingId}`,
      tag: `assignment-${params.bookingId}`,
      category: 'assignments',
    });
  } catch (error) {
    console.error('[push-dispatch] sitterAssigned failed:', error);
  }
}

export async function pushSitterOffer(params: {
  sitterId: string;
  service: string;
  date: string;
  bookingId: string;
}) {
  try {
    await sendPushToSitter(params.sitterId, {
      title: 'New booking offer',
      body: `${params.service} on ${params.date} — respond now`,
      url: `/sitter/dashboard`,
      tag: `offer-${params.bookingId}`,
      category: 'assignments',
    });
  } catch (error) {
    console.error('[push-dispatch] sitterOffer failed:', error);
  }
}

// ─── 5. Replacement needed (callout) ────────────────────────────────

export async function pushReplacementNeeded(params: {
  orgId: string;
  sitterName: string;
  affectedCount: number;
  date: string;
}) {
  try {
    await sendPushToOwners(params.orgId, {
      title: 'Sitter callout',
      body: `${params.sitterName} called out for ${params.date}. ${params.affectedCount} visit${params.affectedCount === 1 ? '' : 's'} need${params.affectedCount === 1 ? 's' : ''} reassignment.`,
      url: '/dashboard',
      tag: `callout-${params.date}`,
      category: 'callouts',
    });
  } catch (error) {
    console.error('[push-dispatch] replacementNeeded failed:', error);
  }
}

// ─── 6. Client sitter change notification ───────────────────────────

export async function pushSitterChanged(params: {
  clientId: string;
  newSitterName: string;
  service: string;
  date: string;
  bookingId: string;
}) {
  try {
    await sendPushToClient(params.clientId, {
      title: 'Sitter updated',
      body: `Your ${params.service} sitter is now ${params.newSitterName}.`,
      url: `/client/bookings/${params.bookingId}`,
      tag: `sitter-change-${params.bookingId}`,
    });
  } catch (error) {
    console.error('[push-dispatch] sitterChanged failed:', error);
  }
}
