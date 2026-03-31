/**
 * Booking Confirmed Handler
 * 
 * ONE THREAD PER CLIENT PER ORG
 * 
 * Idempotent handler that:
 * 1. Finds or creates thread using (orgId, clientId) only - NOT per booking
 * 2. Creates/updates assignment window for the booking
 * 3. Thread number assignment is dynamic based on active windows (computed at send-time)
 * 4. Emits audit + routing trace
 * 5. Ensures automations send from appropriate number based on active state
 */

import { prisma } from '@/lib/db';
import { logAutomationRun } from '@/lib/event-logger';

const DEFAULT_GRACE_PERIOD_MINUTES = 60;

interface BookingConfirmedParams {
  bookingId: string;
  orgId: string;
  clientId: string;
  sitterId?: string | null;
  startAt: Date;
  endAt: Date;
  actorUserId?: string; // User who confirmed (for audit)
}

interface BookingConfirmedResult {
  threadId: string;
  messageNumberId: string;
  numberClass: 'front_desk' | 'sitter' | 'pool';
  windowId: string;
  reused: {
    thread: boolean;
    window: boolean;
  };
}

/**
 * Main entrypoint: Handle booking confirmation
 * 
 * Idempotent: Can be called multiple times safely
 */
export async function onBookingConfirmed(
  params: BookingConfirmedParams
): Promise<BookingConfirmedResult> {
  const { bookingId, orgId, clientId, sitterId, startAt, endAt, actorUserId } = params;

  // A) Find or create thread (idempotent) - ONE THREAD PER CLIENT PER ORG
  const thread = await findOrCreateThread({
    orgId,
    clientId,
    sitterId,
  });

  // B) Number assignment is now dynamic based on active windows
  // We don't assign a fixed number here - it's computed at send-time
  // Store the "preferred" number for initial state, but routing will override
  const initialNumber = await determineInitialThreadNumber({
    orgId,
    threadId: thread.id,
    sitterId,
  });

  // C) Create assignment window
  const window = await findOrCreateAssignmentWindow({
    orgId,
    threadId: thread.id,
    bookingId,
    sitterId,
    startsAt: startAt,
    endsAt: new Date(endAt.getTime() + DEFAULT_GRACE_PERIOD_MINUTES * 60 * 1000),
  });

  // D) Emit audit events
  await emitAuditEvents({
    orgId,
    threadId: thread.id,
    bookingId,
    messageNumberId: initialNumber.numberId,
    windowId: window.id,
    reused: {
      thread: thread.reused,
      window: window.reused,
    },
    actorUserId,
  });

  return {
    threadId: thread.id,
    messageNumberId: initialNumber.numberId,
    numberClass: initialNumber.numberClass,
    windowId: window.id,
    reused: {
      thread: thread.reused,
      window: window.reused,
    },
  };
}

/**
 * A) Find or create thread (idempotent)
 * 
 * ONE THREAD PER CLIENT PER ORG
 * Thread key: {orgId, clientId} only - NOT per booking
 */
async function findOrCreateThread(params: {
  orgId: string;
  clientId: string;
  sitterId?: string | null;
}): Promise<{ id: string; reused: boolean }> {
  const { orgId, clientId, sitterId } = params;

  // Find existing thread for this client (enforced by unique constraint)
  const existing = await (prisma as any).thread.findUnique({
    where: {
      orgId_clientId: {
        orgId,
        clientId,
      },
    },
  });

  if (existing) {
    // Update sitter assignment if changed (but don't change number - that's dynamic)
    if (sitterId && existing.sitterId !== sitterId) {
      await (prisma as any).thread.update({
        where: { id: existing.id },
        data: { sitterId: sitterId },
      });
    }
    return { id: existing.id, reused: true };
  }

  // Need a number first - get front desk as initial default
  const frontDeskNumber = await (prisma as any).messageNumber.findFirst({
    where: {
      orgId,
      class: 'front_desk',
      status: 'active',
    },
  });
  
  if (!frontDeskNumber) {
    // Fallback to any active number
    const anyNumber = await (prisma as any).messageNumber.findFirst({
      where: { orgId, status: 'active' },
    });
    if (!anyNumber) {
      throw new Error(`No available messaging numbers for org ${orgId}. Please configure numbers in Messages → Numbers.`);
    }
  }

  const initialNumber = frontDeskNumber || await (prisma as any).messageNumber.findFirst({
    where: { orgId, status: 'active' },
  });

  // Create new thread (Thread model requires numberId, but it's just initial - routing will override)
  const thread = await (prisma as any).thread.create({
    data: {
      orgId,
      clientId,
      sitterId: sitterId || null,
      numberId: initialNumber.id, // Initial default - actual number used is computed dynamically
      threadType: 'front_desk', // Initial default
      status: 'active',
    },
  });

  // Create participants (ThreadParticipant model)
  await (prisma as any).threadParticipant.createMany({
    data: [
      {
        orgId,
        threadId: thread.id,
        participantType: 'client',
        participantId: clientId,
      },
    ],
  });

  return { id: thread.id, reused: false };
}

/**
 * B) Determine initial thread number (for new threads only)
 * 
 * This is just the initial default. The actual number used for sending
 * is computed dynamically based on active assignment windows.
 * 
 * Rules:
 * - If sitter assigned and has dedicated number → use sitter number
 * - Else → use front desk (pool assignment happens dynamically based on windows)
 */
async function determineInitialThreadNumber(params: {
  orgId: string;
  threadId: string;
  sitterId?: string | null;
}): Promise<{ numberId: string; numberClass: 'front_desk' | 'sitter' | 'pool' }> {
  const { orgId, threadId, sitterId } = params;

  // Check if thread already has a number assigned
  const thread = await (prisma as any).thread.findUnique({
    where: { id: threadId },
    include: { messageNumber: true },
  });

  if (thread?.numberId && thread.messageNumber) {
    return {
      numberId: thread.numberId,
      numberClass: (thread.messageNumber.class as 'front_desk' | 'sitter' | 'pool') || 'front_desk',
    };
  }

  let selectedNumber: { id: string; class: string } | null = null;
  let numberClass: 'front_desk' | 'sitter' | 'pool' = 'front_desk';

  // Rule 1: If sitter assigned, try to use sitter's dedicated number
  if (sitterId) {
    const sitterNumber = await (prisma as any).messageNumber.findFirst({
      where: {
        orgId,
        class: 'sitter',
        assignedSitterId: sitterId,
        status: 'active',
      },
    });

    if (sitterNumber) {
      selectedNumber = { id: sitterNumber.id, class: sitterNumber.class };
      numberClass = 'sitter';
    }
  }

  // Rule 2: Default to front desk (pool assignment happens dynamically)
  if (!selectedNumber) {
    const frontDeskNumber = await (prisma as any).messageNumber.findFirst({
      where: {
        orgId,
        class: 'front_desk',
        status: 'active',
      },
    });

    if (frontDeskNumber) {
      selectedNumber = { id: frontDeskNumber.id, class: frontDeskNumber.class };
      numberClass = 'front_desk';
    } else {
      // No numbers available - this is an error condition
      throw new Error(`No available messaging numbers for org ${orgId}. Please configure numbers in Messages → Numbers.`);
    }
  }

  // Update thread with initial number (this is just a default - routing will override)
  await (prisma as any).thread.update({
    where: { id: threadId },
    data: {
      numberId: selectedNumber.id,
      threadType: numberClass === 'sitter' ? 'assignment' : 'front_desk',
    },
  });

  return {
    numberId: selectedNumber.id,
    numberClass,
  };
}

/**
 * C) Create assignment window (idempotent)
 */
async function findOrCreateAssignmentWindow(params: {
  orgId: string;
  threadId: string;
  bookingId: string;
  sitterId?: string | null;
  startsAt: Date;
  endsAt: Date;
}): Promise<{ id: string; reused: boolean }> {
  const { orgId, threadId, bookingId, sitterId, startsAt, endsAt } = params;

  // Try to find existing window for this booking (AssignmentWindow uses bookingRef, not bookingId)
  const existing = await (prisma as any).assignmentWindow.findFirst({
    where: {
      orgId,
      threadId,
      bookingId: bookingId,
    },
  });

  if (existing) {
    // Update window if dates changed (AssignmentWindow uses sitterId, not responsibleSitterId)
    if (!sitterId) {
      throw new Error('Sitter ID required for assignment window');
    }
    await (prisma as any).assignmentWindow.update({
      where: { id: existing.id },
      data: {
        startAt: startsAt,
        endAt: endsAt,
        sitterId: sitterId,
      },
    });
    return { id: existing.id, reused: true };
  }

  // Check for overlaps (enforce overlap rules)
  const overlapping = await (prisma as any).assignmentWindow.findFirst({
    where: {
      orgId,
      threadId,
      OR: [
        {
          AND: [
            { startAt: { lte: endsAt } },
            { endAt: { gte: startsAt } },
          ],
        },
      ],
    },
  });

  if (overlapping) {
    // Update existing overlapping window instead of creating duplicate
    if (!sitterId) {
      throw new Error('Sitter ID required for assignment window');
    }
    await (prisma as any).assignmentWindow.update({
      where: { id: overlapping.id },
      data: {
        startAt: startsAt,
        endAt: endsAt,
        sitterId: sitterId,
        bookingId: bookingId,
      },
    });
    return { id: overlapping.id, reused: true };
  }

  // Create new window (AssignmentWindow requires sitterId, uses bookingRef not bookingId, no resolutionStatus)
  if (!sitterId) {
    throw new Error('Sitter ID required for assignment window');
  }
  const window = await (prisma as any).assignmentWindow.create({
    data: {
      orgId,
      threadId,
      sitterId: sitterId,
      bookingId: bookingId,
      startAt: startsAt,
      endAt: endsAt,
    },
  });

  return { id: window.id, reused: false };
}

/**
 * D) Emit audit events
 */
async function emitAuditEvents(params: {
  orgId: string;
  threadId: string;
  bookingId: string;
  messageNumberId: string;
  windowId: string;
  reused: { thread: boolean; window: boolean };
  actorUserId?: string;
}): Promise<void> {
  const { orgId, threadId, bookingId, messageNumberId, windowId, reused, actorUserId } = params;

  // Log events using AuditEvent (enterprise-messaging-dashboard schema)
  try {
    // Note: AuditEvent model structure is different - using console.log for now
    // In production, should use the API's AuditService
    console.log('[Booking Confirmed]', {
      threadId,
      messageNumberId,
      windowId,
      bookingId,
      reused,
      actorUserId: actorUserId || 'system',
    });
  } catch (error) {
    // Audit logging is non-blocking
    console.error('Failed to create audit events:', error);
  }
}
