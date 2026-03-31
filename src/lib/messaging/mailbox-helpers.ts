/**
 * Mailbox Helpers
 * 
 * Derives mailbox ownership from existing MessageThread fields.
 * No schema changes needed - uses assignedSitterId + scope to determine mailbox.
 */

/**
 * Determine mailbox type from thread fields
 * 
 * Rules:
 * - Sitter mailbox: assignedSitterId IS NOT NULL AND scope IN ('client_booking', 'client_general')
 * - Owner mailbox: scope = 'internal' OR (assignedSitterId IS NULL AND scope = 'owner_sitter')
 */
export function getMailboxType(thread: {
  assignedSitterId: string | null;
  scope: string;
}): 'sitter' | 'owner' {
  // Sitter mailbox: thread is assigned to a sitter and is client-facing
  if (thread.assignedSitterId && 
      (thread.scope === 'client_booking' || thread.scope === 'client_general')) {
    return 'sitter';
  }
  
  // Owner mailbox: internal threads or owner-sitter threads without assignment
  return 'owner';
}

/**
 * Get mailbox owner ID from thread
 * 
 * For sitter mailbox: returns assignedSitterId
 * For owner mailbox: returns orgId (owner is org-level)
 */
export function getMailboxOwnerId(
  thread: {
    assignedSitterId: string | null;
    orgId: string;
  },
  mailboxType: 'sitter' | 'owner'
): string {
  if (mailboxType === 'sitter') {
    return thread.assignedSitterId || '';
  }
  return thread.orgId; // Owner mailbox is org-level
}

/**
 * Check if thread belongs to sitter mailbox
 */
export function isSitterMailbox(thread: {
  assignedSitterId: string | null;
  scope: string;
}): boolean {
  return getMailboxType(thread) === 'sitter';
}

/**
 * Check if thread belongs to owner mailbox
 */
export function isOwnerMailbox(thread: {
  assignedSitterId: string | null;
  scope: string;
}): boolean {
  return getMailboxType(thread) === 'owner';
}
