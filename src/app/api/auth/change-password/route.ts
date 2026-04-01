/**
 * POST /api/auth/change-password
 *
 * Authenticated password change. Requires current password confirmation.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getSessionSafe } from '@/lib/auth-helpers';

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 12;

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionSafe();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await req.json();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');

    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required.' }, { status: 400 });
    }

    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 }
      );
    }

    // Fetch current password hash
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 403 });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password + set passwordChangedAt to invalidate all existing sessions
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });

    console.info('[ChangePassword] Password changed', { userId: user.id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ChangePassword] Error', error instanceof Error ? { message: error.message } : { error: String(error) });
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
