import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getScopedDb } from '@/lib/tenancy';

const SetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { token, password } = parsed.data;

    // Find user by invite token (raw prisma — no auth context for public endpoint)
    const user = await (prisma as any).user.findFirst({
      where: { inviteToken: token },
      select: { id: true, email: true, orgId: true, sitterId: true, inviteExpiresAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid invite token' }, { status: 400 });
    }

    if (user.inviteExpiresAt && new Date(user.inviteExpiresAt) < new Date()) {
      return NextResponse.json({ error: 'Invite link has expired. Contact your manager for a new one.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Update user: set password, clear invite token
    await (prisma as any).user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });

    // Update sitter onboarding status
    if (user.sitterId && user.orgId) {
      const db = getScopedDb({ orgId: user.orgId });
      await db.sitter.update({
        where: { id: user.sitterId },
        data: { onboardingStatus: 'onboarding' },
      });
    }

    return NextResponse.json({ success: true, email: user.email });
  } catch (error: unknown) {
    console.error('[onboard/set-password] ERROR:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to set password', message }, { status: 500 });
  }
}
