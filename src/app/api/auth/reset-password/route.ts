/**
 * POST /api/auth/reset-password
 *
 * Validates a password reset token and updates the user's password.
 * Clears the token after use.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { hashPasswordResetToken } from '@/lib/security/password-reset';

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 12;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body.token || '').trim();
    const password = String(body.password || '');

    if (!token) {
      return NextResponse.json(
        { error: 'Reset token is required.' },
        { status: 400 }
      );
    }

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const tokenHash = hashPasswordResetToken(token);

    // Find user by hashed token
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: tokenHash },
      select: {
        id: true,
        email: true,
        passwordResetExpiresAt: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check token expiry
    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      // Clear the expired token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      });

      return NextResponse.json(
        { error: 'This reset link has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        passwordChangedAt: new Date(),
      },
    });

    console.info('[ResetPassword] Password reset completed', { userId: user.id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ResetPassword] Error', error instanceof Error ? { message: error.message } : { error: String(error) });
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
