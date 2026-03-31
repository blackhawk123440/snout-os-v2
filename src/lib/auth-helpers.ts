/**
 * Authentication Helper Functions (Gate B Phase 1)
 * 
 * Server-side helpers for session and user management.
 * These functions are safe to call but do not enforce authentication until flags are enabled.
 */

import { NextRequest } from "next/server";
import { auth } from "./auth";
import { prisma } from "./db";
import { env } from "./env";

/**
 * Get session safely - returns session or null
 * Uses NextAuth to get current session
 */
export async function getSessionSafe(request?: NextRequest): Promise<any | null> {
  try {
    if (!env.NEXTAUTH_SECRET) {
      return null;
    }
    
    // Phase 2.2: Use NextAuth to get session
    const session = await auth();
    return session;
  } catch (error) {
    // Silently fail if auth not configured
    return null;
  }
}

/**
 * Require session - throws typed error when no session
 * This function exists for Phase 2 but is NOT called in Phase 1
 */
export class AuthError extends Error {
  constructor(message: string = "Authentication required") {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireSession(request?: NextRequest): Promise<any> {
  const session = await getSessionSafe(request);
  if (!session) {
    throw new AuthError("Authentication required");
  }
  return session;
}

/**
 * Get current user safely - returns user or null
 * Does not throw, safe to call even when auth is not configured
 */
export async function getCurrentUserSafe(request?: NextRequest): Promise<any | null> {
  try {
    const session = await getSessionSafe(request);
    if (!session?.user?.id) {
      return null;
    }

    // Type assertion needed because User model may not exist in Prisma client yet
    const user = await (prisma as any).user?.findUnique({
      where: { id: session.user.id },
      include: {
        sitter: true,
      },
    });

    return user || null;
  } catch (error) {
    // Silently fail - auth not configured yet
    return null;
  }
}

