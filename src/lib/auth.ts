/**
 * Authentication Configuration (Gate B Phase 2.2)
 * 
 * NextAuth.js v5 configuration for Snout OS with credentials provider.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./db";
import { env } from "./env";
import * as bcrypt from "bcryptjs";
import { isBuildPhase, shouldSilenceBuildWarnings } from "./runtime-phase";
import { normalizeSignInEmail, shouldInvalidateSessionToken } from "./auth-utils";

const AUTH_PRIVILEGED_ROLES = new Set(["owner", "admin", "superadmin"]);

function logAuthEvent(event: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(`[NextAuth] ${event}`, details);
    return;
  }
  console.info(`[NextAuth] ${event}`);
}

/**
 * NextAuth configuration with credentials provider
 */
// Ensure secret is ALWAYS defined - NextAuth requires it
const getSecret = (): string => {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

  if (!secret) {
    if (isBuildPhase) {
      if (!shouldSilenceBuildWarnings) {
        console.warn('[NextAuth] NEXTAUTH_SECRET missing during build. Using a temporary build-time placeholder.');
      }
      return 'build-only-secret-not-for-runtime-use-1234567890';
    }
    if (process.env.NODE_ENV === 'production') {
      // HARD FAIL in production — do not fall back to any default
      throw new Error(
        'FATAL: NEXTAUTH_SECRET environment variable is required in production. ' +
        'Set it in Render Environment tab. Application cannot start without it.'
      );
    }
    // Development only — use a dev-specific secret
    console.warn('[NextAuth] WARNING: NEXTAUTH_SECRET not set. Using development fallback. DO NOT use in production.');
    return 'dev-only-secret-not-for-production-minimum-32-characters';
  }

  if (secret.length < 32) {
    throw new Error(
      'FATAL: NEXTAUTH_SECRET must be at least 32 characters. ' +
      'Generate one with: openssl rand -base64 32'
    );
  }

  return secret;
};

const secretValue = getSecret();

// Ensure NEXTAUTH_URL is trimmed (fixes Render trailing newline issue)
// NextAuth reads from process.env, so we need to set it explicitly
if (process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL.trim();
}
// Also use trimmed value from env.ts as fallback
const nextAuthUrl = env.NEXTAUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Session strategy - JWT required for Credentials provider
  // Force JWT sessions for deterministic E2E tests
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Custom pages
  pages: {
    signIn: "/login",
    error: "/login",
  },

  // Cookie settings for HTTPS (production)
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production', // Secure cookies on HTTPS
      },
    },
  },

  // Providers - credentials (email/password) for Phase 2.2
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const enableE2eAuth =
          process.env.NODE_ENV !== 'production' && (
            process.env.ENABLE_E2E_AUTH === "true" ||
            process.env.ENABLE_E2E_LOGIN === "true" ||
            process.env.NODE_ENV === "test"
          );

        // Log if someone tries to enable E2E in production
        if (process.env.NODE_ENV === 'production' &&
            (process.env.ENABLE_E2E_AUTH === 'true' || process.env.ENABLE_E2E_LOGIN === 'true')) {
          console.error('[NextAuth] SECURITY: E2E auth bypass attempted in production. DENIED. Remove ENABLE_E2E_AUTH from production environment.');
        }
        
        const email = normalizeSignInEmail(credentials?.email);
        const password = String(credentials?.password ?? "");

        if (!email || !password) {
          logAuthEvent('authorize_rejected', { reason: 'missing_credentials' });
          return null;
        }

        // Find user by email
        let user;
        try {
          // Note: API schema doesn't have sitterId directly, it's a relation
          // We'll get it via the sitter relation if needed
          // Use type assertion since Prisma client types may not match exactly
          user = await (prisma as any).user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            select: { 
              id: true, 
              email: true, 
              name: true, 
              passwordHash: true,
              orgId: true,
              role: true,
              deletedAt: true,
              sitter: { select: { id: true } },
              client: { select: { id: true } },
            },
          });
        } catch (error: any) {
          console.error('[NextAuth] authorize database lookup failed', {
            code: error?.code,
            message: error?.message,
          });
          return null;
        }

        if (!user) {
          logAuthEvent('authorize_rejected', { reason: 'invalid_credentials' });
          return null;
        }

        if ((user as any).deletedAt) {
          logAuthEvent('authorize_rejected', { reason: 'account_unavailable', userId: user.id });
          return null;
        }

        // Credentials auth requires a bcrypt password hash.
        if (user.passwordHash) {
          try {
            const isValid = await bcrypt.compare(
              password,
              user.passwordHash
            );
            if (!isValid) {
              // For E2E tests, allow bypassing password when E2E_AUTH is enabled
              // This allows deterministic E2E authentication without password verification
              if (enableE2eAuth) {
                logAuthEvent('authorize_bypass_enabled', { userId: user.id, reason: 'e2e_auth' });
              } else {
                logAuthEvent('authorize_rejected', { reason: 'invalid_credentials' });
                return null;
              }
            }
          } catch (error: any) {
            console.error('[NextAuth] password verification failed', {
              userId: user.id,
              message: error?.message,
            });
            return null;
          }
        } else {
          logAuthEvent('authorize_rejected', { reason: 'password_auth_unavailable', userId: user.id });
          return null;
        }

        // Resolve clientId: from User.client relation, or by Client lookup (orgId + email)
        let clientId: string | null = (user as any).client?.id || null;
        if (!clientId && (user as any).role === 'client' && (user as any).orgId && user.email) {
          const client = await (prisma as any).client.findFirst({
            where: { orgId: (user as any).orgId, email },
            select: { id: true },
          });
          clientId = client?.id || null;
        }

        logAuthEvent('authorize_success', { userId: user.id, role: (user as any).role });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          orgId: (user as any).orgId,
          role: (user as any).role,
          sitterId: (user as any).sitter?.id || null,
          clientId,
        };
      },
    }),
  ],

  // Callbacks
  callbacks: {
    async session({ session, token }: any) {
      // Ensure session.user exists (NextAuth might not create it initially)
      if (!session.user) {
        session.user = {} as any;
      }
      
      // Populate user from JWT token (no database query to avoid failures)
      // Token should have id, email, name, orgId, role, sitterId from jwt callback
      if (token) {
        if (token.id) session.user.id = token.id as string;
        if (token.email) session.user.email = token.email as string;
        if (token.name) session.user.name = token.name as string;
        if (token.orgId) (session.user as any).orgId = token.orgId;
        if (token.role) (session.user as any).role = token.role;
        if (token.sitterId) (session.user as any).sitterId = token.sitterId;
        if (token.clientId) (session.user as any).clientId = token.clientId;
      } else {
        // If token is null/undefined, NextAuth couldn't decode the JWT
        // This means our manually created JWT isn't being decoded correctly
        console.warn('[NextAuth] Session callback received null token - JWT decode may have failed');
      }
      return session;
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.orgId = (user as any).orgId;
        token.role = (user as any).role;
        token.sitterId = (user as any).sitterId;
        token.clientId = (user as any).clientId;
      }

      // Invalidate session if password was changed after token was issued
      if (token.id && token.iat) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { passwordChangedAt: true, deletedAt: true },
          });
          if (shouldInvalidateSessionToken({
            deletedAt: dbUser?.deletedAt,
            passwordChangedAt: dbUser?.passwordChangedAt,
            tokenIssuedAtSec: typeof token.iat === "number" ? token.iat : null,
          })) {
            return {};
          }
        } catch (error) {
          console.error('[NextAuth] session verification failed; preserving JWT', {
            userId: token.id,
            role: token.role,
            privileged: AUTH_PRIVILEGED_ROLES.has(String(token.role || '')),
            message: error instanceof Error ? error.message : String(error),
          });
          return token;
        }
      }

      return token;
    },
  },

  // Security - ensure secret is always defined
  secret: secretValue,
  
  // Trust proxy for Render (HTTPS behind proxy)
  trustHost: true,
});
