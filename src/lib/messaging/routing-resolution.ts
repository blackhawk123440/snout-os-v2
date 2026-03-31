/**
 * Routing Resolution Engine
 * 
 * Phase 2.1: Assignment Window Enforcement
 * 
 * Resolves routing decisions for inbound messages based on AssignmentWindow
 * at a specific timestamp.
 */

import { prisma } from '@/lib/db';

export interface RoutingResolution {
  target: 'sitter' | 'owner_inbox';
  sitterId?: string;
  reason: string;
  metadata: {
    activeWindowsCount: number;
    matchingWindowIds?: string[];
    conflictingWindowIds?: string[];
    timestamp: Date;
  };
}

/**
 * Resolve routing for inbound message based on AssignmentWindow at timestamp
 * 
 * Rules:
 * - Exactly one active window → route to that sitter
 * - No active window → route to owner inbox
 * - Overlapping active windows → route to owner inbox by default
 * 
 * @param threadId - MessageThread ID
 * @param timestamp - Message timestamp (defaults to now)
 * @returns Routing resolution with target, sitterId, reason, and metadata
 */
export async function resolveRoutingForInboundMessage(
  threadId: string,
  timestamp: Date = new Date()
): Promise<RoutingResolution> {
  // Find all active assignment windows for this thread at the given timestamp
  // Note: AssignmentWindow doesn't have status field - filter by time range only
  const activeWindows = await (prisma as any).assignmentWindow.findMany({
    where: {
      threadId,
      startAt: {
        lte: timestamp,
      },
      endAt: {
        gte: timestamp,
      },
    },
    include: {
      sitter: {
        select: {
          id: true,
          name: true, // Sitter model has name, not firstName/lastName
        },
      },
    },
    orderBy: {
      startAt: 'asc',
    },
  });

  // Rule 1: No active windows → route to owner inbox
  if (activeWindows.length === 0) {
    return {
      target: 'owner_inbox',
      reason: 'No active assignment window at message timestamp',
      metadata: {
        activeWindowsCount: 0,
        timestamp,
      },
    };
  }

  // Rule 2: Exactly one active window → route to that sitter
  if (activeWindows.length === 1) {
    const window = activeWindows[0];
    return {
      target: 'sitter',
      sitterId: window.sitterId,
      reason: 'Exactly one active assignment window matches timestamp',
      metadata: {
        activeWindowsCount: 1,
        matchingWindowIds: [window.id],
        timestamp,
      },
    };
  }

  // Rule 3: Multiple overlapping active windows → route to owner inbox
  // This prevents wrong routing in complex overlap scenarios
  return {
    target: 'owner_inbox',
    reason: `Multiple overlapping active assignment windows (${activeWindows.length}) detected - requires owner intervention`,
    metadata: {
      activeWindowsCount: activeWindows.length,
      conflictingWindowIds: activeWindows.map((w: any) => w.id),
      timestamp,
    },
  };
}

/**
 * Check if a sitter has an active assignment window for a thread at a specific timestamp
 * 
 * Used for sitter send gating (Phase 2.2)
 * 
 * @param sitterId - Sitter ID
 * @param threadId - MessageThread ID
 * @param timestamp - Timestamp to check (defaults to now)
 * @returns true if sitter has an active window, false otherwise
 */
export async function hasActiveAssignmentWindow(
  sitterId: string,
  threadId: string,
  timestamp: Date = new Date()
): Promise<boolean> {
  const window = await (prisma as any).assignmentWindow.findFirst({
    where: {
      sitterId,
      threadId,
      // status field doesn't exist - filter by time range only
      startAt: {
        lte: timestamp,
      },
      endAt: {
        gte: timestamp,
      },
    },
  });

  return window !== null;
}

/**
 * Get all active assignment windows for a sitter and thread
 * 
 * Helper for sitter send gating and window management
 * 
 * @param sitterId - Sitter ID
 * @param threadId - MessageThread ID
 * @param timestamp - Timestamp to check (defaults to now)
 * @returns Array of active assignment windows
 */
export async function getActiveAssignmentWindows(
  sitterId: string,
  threadId: string,
  timestamp: Date = new Date()
): Promise<Array<{ id: string; startsAt: Date; endsAt: Date }>> {
  const windows = await (prisma as any).assignmentWindow.findMany({
    where: {
      sitterId,
      threadId,
      // status field doesn't exist - filter by time range only
      startAt: {
        lte: timestamp,
      },
      endAt: {
        gte: timestamp,
      },
    },
    select: {
      id: true,
      startAt: true,
      endAt: true,
    },
    orderBy: {
      startAt: 'asc',
    },
  });

  return windows;
}

/**
 * Get next upcoming assignment window for sitter and thread
 * Phase 4.2: Used for friendly send-gating UX (show "Your window is X–Y")
 */
export async function getNextUpcomingWindow(
  sitterId: string,
  threadId: string,
  after: Date = new Date()
): Promise<{ startsAt: Date; endsAt: Date } | null> {
  const window = await (prisma as any).assignmentWindow.findFirst({
    where: {
      sitterId,
      threadId,
      // status field doesn't exist - filter by time range only
      startAt: { gt: after },
    },
    select: { startAt: true, endAt: true },
    orderBy: { startAt: 'asc' },
  });
  return window;
}
