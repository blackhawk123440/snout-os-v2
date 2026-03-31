/**
 * Assignment Window Helpers
 * 
 * Phase 2.3: Window Creation and Maintenance
 * 
 * Creates and maintains AssignmentWindow records from bookings with default buffers.
 */

import { prisma } from '@/lib/db';
import { getDefaultOrgId } from './org-helpers';

/**
 * Buffer configuration for different service types
 * 
 * Per Messaging Master Spec V1:
 * - Drop-in and walk: 60 minutes before start, 60 minutes after end
 * - House sitting: 2 hours before start, 2 hours after end
 */
const BUFFER_CONFIG: Record<string, { preMinutes: number; postMinutes: number }> = {
  'Drop-ins': { preMinutes: 60, postMinutes: 60 },
  'Dog Walking': { preMinutes: 60, postMinutes: 60 },
  'Housesitting': { preMinutes: 120, postMinutes: 120 }, // 2 hours
  '24/7 Care': { preMinutes: 120, postMinutes: 120 }, // 2 hours
  'Pet Taxi': { preMinutes: 60, postMinutes: 60 },
};

/**
 * Get buffer configuration for a service type
 * Defaults to 60 minutes if service type not found
 */
function getBufferForService(service: string): { preMinutes: number; postMinutes: number } {
  return BUFFER_CONFIG[service] || { preMinutes: 60, postMinutes: 60 };
}

/**
 * Calculate assignment window start and end times from booking with buffers
 */
export function calculateAssignmentWindow(
  bookingStartAt: Date,
  bookingEndAt: Date,
  service: string
): { startsAt: Date; endsAt: Date } {
  const buffer = getBufferForService(service);
  
  const startsAt = new Date(bookingStartAt);
  startsAt.setMinutes(startsAt.getMinutes() - buffer.preMinutes);
  
  const endsAt = new Date(bookingEndAt);
  endsAt.setMinutes(endsAt.getMinutes() + buffer.postMinutes);
  
  return { startsAt, endsAt };
}

/**
 * Create assignment window for a booking and thread
 * 
 * Called when:
 * - Booking is created with sitter assignment
 * - Booking is updated (sitter assigned or times changed)
 * 
 * @param bookingId - Booking ID
 * @param threadId - MessageThread ID
 * @param sitterId - Assigned sitter ID
 * @param bookingStartAt - Booking start time
 * @param bookingEndAt - Booking end time
 * @param service - Service type (for buffer calculation)
 * @param orgId - Organization ID (optional, will be resolved if not provided)
 * @returns Created AssignmentWindow
 */
export async function createAssignmentWindow(
  bookingId: string,
  threadId: string,
  sitterId: string,
  bookingStartAt: Date,
  bookingEndAt: Date,
  service: string,
  orgId?: string
): Promise<{ id: string; startsAt: Date; endsAt: Date }> {
  const resolvedOrgId = orgId || (await getDefaultOrgId());
  
  // Calculate window with buffers
  const { startsAt, endsAt } = calculateAssignmentWindow(bookingStartAt, bookingEndAt, service);
  
  // Create assignment window
  const window = await (prisma as any).assignmentWindow.create({
    data: {
      orgId: resolvedOrgId,
      threadId,
      bookingId,
      sitterId,
      startAt: startsAt,
      endAt: endsAt,
      // status field doesn't exist
    },
  });
  
  return {
    id: window.id,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
  };
}

/**
 * Update assignment window for a booking
 * 
 * Called when booking times change or sitter is reassigned
 * 
 * @param windowId - AssignmentWindow ID
 * @param bookingStartAt - Updated booking start time
 * @param bookingEndAt - Updated booking end time
 * @param service - Service type (for buffer calculation)
 * @param sitterId - Updated sitter ID (optional)
 * @returns Updated AssignmentWindow
 */
export async function updateAssignmentWindow(
  windowId: string,
  bookingStartAt: Date,
  bookingEndAt: Date,
  service: string,
  sitterId?: string
): Promise<{ id: string; startsAt: Date; endsAt: Date }> {
  // Calculate window with buffers
  const { startsAt, endsAt } = calculateAssignmentWindow(bookingStartAt, bookingEndAt, service);
  
  // Update assignment window
  const updateData: {
    startAt: Date;
    endAt: Date;
    sitterId?: string;
  } = {
    startAt: startsAt,
    endAt: endsAt,
  };
  
  if (sitterId) {
    updateData.sitterId = sitterId;
  }
  
  const window = await (prisma as any).assignmentWindow.update({
    where: { id: windowId },
    data: updateData,
  });
  
  return {
    id: window.id,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
  };
}

/**
 * Close assignment window (mark as closed)
 * 
 * Called when:
 * - Booking is cancelled
 * - Booking is completed
 * 
 * @param windowId - AssignmentWindow ID
 */
export async function closeAssignmentWindow(windowId: string): Promise<void> {
  // Note: AssignmentWindow doesn't have status field
  // Instead, we can delete the window or mark it as expired by setting endAt to past
  await (prisma as any).assignmentWindow.update({
    where: { id: windowId },
    data: { endAt: new Date() }, // Set endAt to now to effectively close it
  });
}

/**
 * Close all assignment windows for a booking
 * 
 * Called when booking is cancelled or completed
 * 
 * @param bookingId - Booking ID
 */
export async function closeAllBookingWindows(bookingId: string): Promise<void> {
  // Note: AssignmentWindow doesn't have status field
  // Set endsAt to now to effectively close all windows for this booking
  await (prisma as any).assignmentWindow.updateMany({
    where: {
      bookingId: bookingId,
      endAt: { gte: new Date() }, // Only update windows that haven't ended yet
    },
    data: { endAt: new Date() }, // Set endAt to now to close them
  });
}

/**
 * Find or create assignment window for booking and thread
 * 
 * If window exists, updates it. Otherwise creates new one.
 * 
 * @param bookingId - Booking ID
 * @param threadId - MessageThread ID
 * @param sitterId - Assigned sitter ID
 * @param bookingStartAt - Booking start time
 * @param bookingEndAt - Booking end time
 * @param service - Service type
 * @param orgId - Organization ID (optional)
 * @returns AssignmentWindow ID
 */
export async function findOrCreateAssignmentWindow(
  bookingId: string,
  threadId: string,
  sitterId: string,
  bookingStartAt: Date,
  bookingEndAt: Date,
  service: string,
  orgId?: string
): Promise<string> {
  // Check if window already exists
  // Note: AssignmentWindow doesn't have status field
  const existingWindow = await (prisma as any).assignmentWindow.findFirst({
    where: {
      bookingId: bookingId,
      threadId,
      endAt: { gte: new Date() }, // Only find windows that haven't ended yet
    },
  });
  
  if (existingWindow) {
    // Update existing window
    const updated = await updateAssignmentWindow(
      existingWindow.id,
      bookingStartAt,
      bookingEndAt,
      service,
      sitterId
    );
    return updated.id;
  }
  
  // Create new window
  const created = await createAssignmentWindow(
    bookingId,
    threadId,
    sitterId,
    bookingStartAt,
    bookingEndAt,
    service,
    orgId
  );
  return created.id;
}
