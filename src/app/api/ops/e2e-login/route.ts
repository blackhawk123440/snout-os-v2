/**
 * E2E Login Route
 * Creates a session for Playwright E2E tests without password verification.
 *
 * SECURITY: This endpoint is DISABLED in production except in CI. It is only enabled when:
 * - (NODE_ENV !== "production" OR CI === "true") AND
 * - (ENABLE_E2E_AUTH=true OR ENABLE_E2E_LOGIN=true) AND
 * - Valid x-e2e-key header matches E2E_AUTH_KEY
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encode } from 'next-auth/jwt';
import { env } from '@/lib/env';

function isE2eLoginAllowed(): boolean {
  const envName = (process.env.ENV_NAME || process.env.NEXT_PUBLIC_ENV || '').toLowerCase();
  const isStagingEnv = envName === 'staging';
  // In production, allow only in CI. Staging can opt-in via env flags + key.
  if (process.env.NODE_ENV === 'production' && process.env.CI !== 'true' && !isStagingEnv) return false;
  const enabled =
    process.env.ENABLE_E2E_AUTH === 'true' || process.env.ENABLE_E2E_LOGIN === 'true';
  return enabled;
}

export async function POST(req: NextRequest) {
  try {
    if (!isE2eLoginAllowed()) {
      return NextResponse.json({ error: 'E2E login disabled' }, { status: 403 });
    }

    const key = req.headers.get('x-e2e-key');
    const expected = process.env.E2E_AUTH_KEY || 'test-e2e-key-change-in-production';
    if (!key || key !== expected) {
      return NextResponse.json({ error: 'Invalid or missing x-e2e-key' }, { status: 401 });
    }

    let body: { role?: string; email?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const role = (body.role || 'owner').toLowerCase();
    const email = body.email || (role === 'owner' ? 'owner@example.com' : role === 'sitter' ? 'sitter@example.com' : 'client@example.com');

    let user = await (prisma as any).user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        orgId: true,
        role: true,
        sitter: { select: { id: true } },
        client: { select: { id: true } },
      },
    });

    // Staging resilience: when default fixture emails are absent, fall back to role-based lookup.
    if (!user && !body.email) {
      const baseSelect = {
        id: true,
        email: true,
        name: true,
        orgId: true,
        role: true,
        sitter: { select: { id: true } },
        client: { select: { id: true } },
      };
      if (role === 'owner') {
        user = await (prisma as any).user.findFirst({
          where: {
            OR: [{ role: 'owner' }, { role: 'admin' }],
          },
          select: baseSelect,
        });
      } else if (role === 'sitter') {
        user = await (prisma as any).user.findFirst({
          where: { role: 'sitter', sitterId: { not: null } },
          select: baseSelect,
        });
      } else if (role === 'client') {
        user = await (prisma as any).user.findFirst({
          where: { role: 'client', clientId: { not: null } },
          select: baseSelect,
        });
      }
    }

    if (!user) {
      return NextResponse.json({ error: `User not found: ${email}` }, { status: 404 });
    }

    if (!user.email) {
      return NextResponse.json({ error: `User ${email} has no email` }, { status: 500 });
    }

    const roleMatch = role === (user.role || '').toLowerCase() ||
      (role === 'sitter' && user.sitter?.id) ||
      (role === 'client' && user.client?.id);
    if (!roleMatch) {
      return NextResponse.json({ error: `User ${email} does not have role ${role}` }, { status: 403 });
    }

    const secret =
      process.env.NEXTAUTH_SECRET ||
      env.NEXTAUTH_SECRET ||
      (process.env.NODE_ENV === 'development'
        ? 'dev-secret-key-change-in-production-min-32-chars'
        : 'staging-fallback-secret-minimum-32-characters-required-for-nextauth');
    const secure = process.env.NODE_ENV === 'production';
    const cookieName = secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
    const token = await encode({
      secret,
      salt: cookieName,
      token: {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        orgId: user.orgId,
        role: user.role,
        sitterId: user.sitter?.id ?? null,
        clientId: user.client?.id ?? null,
      } as Record<string, unknown>,
      maxAge: 30 * 24 * 60 * 60,
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure,
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/ops/e2e-login] Unexpected failure:', message);
    return NextResponse.json({ error: 'E2E login internal error', message }, { status: 500 });
  }
}
