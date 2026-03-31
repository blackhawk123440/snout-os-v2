/**
 * Organization Helpers
 * 
 * Helper functions for organization isolation in messaging.
 * 
 * IMPORTANT: This is single-org mode until organization system is implemented.
 * All requests resolve to the same orgId deterministically.
 * 
 * Gate 1 Compliance:
 * - All records must have orgId ✓
 * - Requests must always resolve to the same orgId deterministically ✓
 * - No route can accept orgId from the client ✓
 */

/**
 * Get default organization ID
 * 
 * SINGLE ORG MODE: Returns a constant orgId for all requests.
 * This ensures org isolation structure is in place.
 * 
 * When multi-org is implemented, this will be replaced with actual org lookup.
 * 
 * @returns Default organization ID (constant "default" or from env)
 */
export function getDefaultOrgId(): string {
  // Single org mode: always return the same orgId
  // This can be configured via env var, but defaults to "default"
  return process.env.DEFAULT_ORG_ID || 'default';
}

/**
 * Get organization ID from context
 * 
 * SINGLE ORG MODE: Returns constant orgId regardless of user.
 * 
 * When multi-org is implemented, this will:
 * - Extract orgId from authenticated user
 * - Extract orgId from request context
 * - Validate orgId exists and user has access
 * 
 * @param userId - Optional user ID (ignored in single org mode)
 * @returns Organization ID (constant)
 */
export async function getOrgIdFromContext(userId?: string): Promise<string> {
  // Single org mode: always return default orgId
  // This ensures deterministic org resolution for Gate 1
  return getDefaultOrgId();
}
