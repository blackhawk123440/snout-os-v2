/**
 * Proxy Auth Helper
 * 
 * Converts NextAuth session to JWT token for NestJS API authentication.
 * The NestJS API expects: Authorization: Bearer <token>
 */

import { getSessionSafe } from "@/lib/auth-helpers";
import { getOrgIdFromContext } from "@/lib/messaging/org-helpers";
import * as jose from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';

/**
 * Generate JWT token from NextAuth session for NestJS API
 */
export async function generateAPIToken(session: any): Promise<string | null> {
  if (!session?.user) {
    return null;
  }

  if (!JWT_SECRET) {
    console.error('[Proxy Auth] JWT_SECRET not set. Cannot generate API token.');
    return null;
  }

  try {
    // Fetch orgId from context (required by NestJS API)
    const orgId = await getOrgIdFromContext(session.user.id);
    
    // Create JWT payload matching NestJS API expectations
    const payload = {
      sub: session.user.id,
      orgId: orgId || '',
      email: session.user.email || '',
      role: (session.user as any).sitterId ? 'sitter' : 'owner',
    };

    // Sign JWT using same secret as NestJS API
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    return token;
  } catch (error: any) {
    console.error('[Proxy Auth] Error generating API token:', error);
    return null;
  }
}

/**
 * Get API auth header from request
 */
export async function getAPIAuthHeader(request: Request): Promise<string | null> {
  const session = await getSessionSafe();
  if (!session?.user) {
    return null;
  }

  const token = await generateAPIToken(session);
  return token ? `Bearer ${token}` : null;
}
