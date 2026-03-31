/**
 * Owner Helper Functions
 * 
 * Server-side helpers for owner authentication and access control.
 */

import { NextRequest } from "next/server";
import { getCurrentUserSafe } from "./auth-helpers";
import { getCurrentSitterId } from "./sitter-helpers";

/**
 * Check if current user is owner (not a sitter)
 * 
 * In this system, owner = authenticated user without sitterId
 */
export async function isOwner(request?: NextRequest): Promise<boolean> {
  try {
    const user = await getCurrentUserSafe(request);
    if (!user) {
      return false;
    }

    // Owner = user without sitterId
    const sitterId = await getCurrentSitterId(request);
    return !sitterId; // Owner if not a sitter
  } catch (error) {
    return false;
  }
}

/**
 * Require owner authentication
 * Throws error if user is not authenticated as owner
 */
export class OwnerAuthError extends Error {
  constructor(message: string = "Owner authentication required") {
    super(message);
    this.name = "OwnerAuthError";
  }
}

export async function requireOwner(request?: NextRequest): Promise<any> {
  const user = await getCurrentUserSafe(request);
  if (!user) {
    throw new OwnerAuthError("Authentication required");
  }

  const sitterId = await getCurrentSitterId(request);
  if (sitterId) {
    throw new OwnerAuthError("Owner access required - sitters cannot access this resource");
  }

  return user;
}
