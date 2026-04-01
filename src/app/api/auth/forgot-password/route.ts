/**
 * POST /api/auth/forgot-password
 *
 * Sends a password reset email with a secure token.
 * Always returns 200 to prevent user enumeration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { passwordResetEmail } from '@/lib/email-templates/password-reset';
import { hashPasswordResetToken, RESET_TOKEN_EXPIRY_MINUTES } from '@/lib/security/password-reset';
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;

// Simple in-memory rate limiter for reset requests per email
const resetAttempts = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const entry = resetAttempts.get(email);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    resetAttempts.set(email, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      // Still return 200 to prevent enumeration
      return NextResponse.json({ ok: true });
    }

    // Rate limit per email
    if (isRateLimited(email)) {
      // Silent success to prevent enumeration
      return NextResponse.json({ ok: true });
    }

    // Find user (don't reveal if user exists)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      // Return same response whether user exists or not
      return NextResponse.json({ ok: true });
    }

    // Generate secure reset token
    const token = randomUUID();
    const tokenHash = hashPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Save token to user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    // Build reset URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send email
    const template = passwordResetEmail({
      name: user.name || '',
      resetUrl,
      expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
    });

    const result = await sendEmail({
      to: user.email!,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    if (!result.success) {
      console.error('[ForgotPassword] Email send failed', {
        userId: user.id,
        error: result.error,
      });
    }

    console.info('[ForgotPassword] Reset token issued', {
      userId: user.id,
      expiresAt: expiresAt.toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ForgotPassword] Error', error instanceof Error ? { message: error.message } : { error: String(error) });
    // Still return 200 to prevent information leakage
    return NextResponse.json({ ok: true });
  }
}
