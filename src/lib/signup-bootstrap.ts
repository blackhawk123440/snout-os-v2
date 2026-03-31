/**
 * Owner signup + org bootstrap: transactional creation with idempotency.
 * Creates User, Org, BusinessSettings, OrgNotificationSettings in one Prisma transaction.
 */

import { prisma } from '@/lib/db';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes for OAuth state

export interface SignupInput {
  email: string;
  password: string;
  name?: string | null;
  idempotencyKey?: string | null;
}

export interface SignupResult {
  userId: string;
  orgId: string;
  email: string;
  created: boolean;
}

/**
 * Check idempotency: if this email already completed signup, return existing.
 * Uses SignupIdempotency (and User by email) so duplicate submits do not create duplicate orgs/users.
 */
export async function resolveSignupIdempotency(
  email: string,
  idempotencyKey: string | null
): Promise<{ existing: SignupResult } | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const existingRecord = await (prisma as any).signupIdempotency.findUnique({
    where: { email: normalizedEmail },
    select: { userId: true, orgId: true, email: true },
  });
  if (existingRecord?.userId && existingRecord?.orgId) {
    return {
      existing: {
        userId: existingRecord.userId,
        orgId: existingRecord.orgId,
        email: existingRecord.email,
        created: false,
      },
    };
  }

  const existingUser = await (prisma as any).user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, orgId: true, email: true },
  });
  if (existingUser) {
    await (prisma as any).signupIdempotency.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        userId: existingUser.id,
        orgId: existingUser.orgId,
        idempotencyKey: idempotencyKey ?? null,
      },
      update: { userId: existingUser.id, orgId: existingUser.orgId, updatedAt: new Date() },
    });
    return {
      existing: {
        userId: existingUser.id,
        orgId: existingUser.orgId,
        email: existingUser.email ?? normalizedEmail,
        created: false,
      },
    };
  }
  return null;
}

/**
 * Bootstrap new org + owner in a single Prisma transaction.
 * On failure, logs to AppErrorLog and rethrows.
 */
export async function bootstrapOrgAndOwner(input: SignupInput): Promise<SignupResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 10);
  const orgId = randomUUID();
  const userId = randomUUID();
  const now = new Date();

  try {
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.org.create({
        data: {
          id: orgId,
          name: input.name ? `${input.name}'s organization` : `${normalizedEmail} organization`,
          mode: 'personal',
        },
      });
      await tx.businessSettings.create({
        data: {
          orgId,
          businessName: input.name ?? normalizedEmail,
        },
      });
      await tx.orgNotificationSettings.create({
        data: { orgId },
      });
      await tx.user.create({
        data: {
          id: userId,
          orgId,
          role: 'OWNER',
          email: normalizedEmail,
          name: input.name ?? null,
          passwordHash,
          emailVerified: now,
          sitterId: null,
          clientId: null,
        },
      });
      await tx.signupIdempotency.create({
        data: {
          email: normalizedEmail,
          userId,
          orgId,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });
    });
  } catch (error) {
    const err = error as Error;
    await logSignupBootstrapError(err, { email: normalizedEmail, orgId, userId });
    throw error;
  }

  return { userId, orgId, email: normalizedEmail, created: true };
}

/**
 * Log signup/bootstrap failure to AppErrorLog (and EventLog for ops visibility).
 */
export async function logSignupBootstrapError(
  error: Error,
  context: { email?: string; orgId?: string; userId?: string }
): Promise<void> {
  const code = 'signup.bootstrap_failed';
  const message = error.message;
  const contextJson = JSON.stringify(context);
  try {
    await (prisma as any).appErrorLog.create({
      data: { code, message, context: contextJson },
    });
  } catch (e) {
    console.error('[signup-bootstrap] Failed to write AppErrorLog:', e);
  }
  try {
    await (prisma as any).eventLog.create({
      data: {
        orgId: context.orgId ?? 'system',
        eventType: code,
        status: 'failed',
        error: message,
        metadata: contextJson,
      },
    });
  } catch (e) {
    console.error('[signup-bootstrap] Failed to write EventLog:', e);
  }
}

/**
 * OAuth state: encode orgId, userId, and expiry for callback verification.
 */
export function encodeOAuthState(payload: { orgId: string; userId: string; sitterId?: string }): string {
  const state = {
    ...payload,
    exp: Date.now() + STATE_EXPIRY_MS,
  };
  return Buffer.from(JSON.stringify(state)).toString('base64');
}

/**
 * Decode and verify OAuth state: must include orgId and userId; reject if expired or mismatch.
 */
export function decodeAndVerifyOAuthState(
  stateBase64: string,
  expected: { orgId: string; userId: string }
): { sitterId?: string } | null {
  try {
    const raw = Buffer.from(stateBase64, 'base64').toString('utf8');
    const state = JSON.parse(raw) as { orgId?: string; userId?: string; sitterId?: string; exp?: number };
    if (state.exp != null && Date.now() > state.exp) return null;
    if (state.orgId !== expected.orgId || state.userId !== expected.userId) return null;
    return { sitterId: state.sitterId };
  } catch {
    return null;
  }
}

/**
 * Log OAuth/integration callback rejection to AppErrorLog (e.g. wrong org, expired state).
 */
export async function logOAuthCallbackRejection(
  code: string,
  context: Record<string, unknown>
): Promise<void> {
  try {
    await (prisma as any).appErrorLog.create({
      data: {
        code: `oauth.callback_rejected`,
        message: code,
        context: JSON.stringify(context),
      },
    });
  } catch (e) {
    console.error('[signup-bootstrap] Failed to write AppErrorLog for OAuth rejection:', e);
  }
}
