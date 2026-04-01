import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

const SetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
  referralCode: z.string().max(20).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { token, password, referralCode } = parsed.data;

    // Find user by welcome token (raw prisma — no auth context for public endpoint)
    const user = await (prisma as any).user.findFirst({
      where: { welcomeToken: token },
      select: { id: true, email: true, orgId: true, clientId: true, welcomeTokenExpiresAt: true, referredBy: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid setup token' }, { status: 400 });
    }

    if (user.welcomeTokenExpiresAt && new Date(user.welcomeTokenExpiresAt) < new Date()) {
      return NextResponse.json({ error: 'Setup link has expired. Contact your pet sitter for a new one.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Process referral code if provided and not already referred
    let referralApplied = false;
    let referralError: string | null = null;
    if (referralCode && !user.referredBy) {
      // Validate: find the referrer by referral code
      const referrer = await (prisma as any).user.findFirst({
        where: { referralCode, id: { not: user.id } }, // prevent self-referral
        select: { id: true, clientId: true },
      });

      if (referrer) {
        // Set referredBy on the new user
        await (prisma as any).user.update({
          where: { id: user.id },
          data: { referredBy: referralCode },
        });

        referralApplied = true;
      } else {
        referralError = 'Invalid referral code';
      }
    }

    // Update user: set password, clear welcome token
    await (prisma as any).user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        welcomeToken: null,
        welcomeTokenExpiresAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      email: user.email,
      referralApplied,
      referralPendingQualification: referralApplied,
      ...(referralError ? { referralError } : {}),
    });
  } catch (error: unknown) {
    console.error('[client/setup/set-password] ERROR:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to set password', message }, { status: 500 });
  }
}
