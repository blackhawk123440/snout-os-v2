/**
 * POST /api/auth/signup
 * Owner signup + org bootstrap. Idempotent by email; duplicate submits return existing.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveSignupIdempotency,
  bootstrapOrgAndOwner,
  type SignupInput,
} from '@/lib/signup-bootstrap';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

const SIGNUP_RATE_LIMIT = {
  keyPrefix: 'signup',
  limit: 5,
  windowSec: 300, // 5 attempts per 5 minutes per IP
};

const SignupBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().max(256).optional().nullable(),
  idempotencyKey: z.string().max(256).optional().nullable(),
});

export async function POST(request: NextRequest) {
  // Rate limit by IP to prevent signup spam
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await checkRateLimit(ip, SIGNUP_RATE_LIMIT);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 300) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SignupBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const input: SignupInput = {
    email: parsed.data.email,
    password: parsed.data.password,
    name: parsed.data.name ?? undefined,
    idempotencyKey: parsed.data.idempotencyKey ?? undefined,
  };

  const idempotencyKey =
    request.headers.get('idempotency-key')?.trim() || input.idempotencyKey || null;

  const existing = await resolveSignupIdempotency(input.email, idempotencyKey);
  if (existing) {
    return NextResponse.json({
      userId: existing.existing.userId,
      orgId: existing.existing.orgId,
      email: existing.existing.email,
      created: false,
    });
  }

  try {
    const result = await bootstrapOrgAndOwner(input);
    return NextResponse.json({
      userId: result.userId,
      orgId: result.orgId,
      email: result.email,
      created: result.created,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bootstrap failed';
    return NextResponse.json(
      { error: 'Signup failed', message },
      { status: 500 }
    );
  }
}
