import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) {
    return NextResponse.json({ valid: false, reason: 'missing' }, { status: 400 });
  }

  try {
    // Raw prisma — no auth context needed, this is a public endpoint
    const user = await (prisma as any).user.findFirst({
      where: { inviteToken: token },
      select: {
        id: true,
        email: true,
        name: true,
        inviteExpiresAt: true,
        sitterId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ valid: false, reason: 'invalid' });
    }

    if (user.inviteExpiresAt && new Date(user.inviteExpiresAt) < new Date()) {
      return NextResponse.json({ valid: false, reason: 'expired' });
    }

    return NextResponse.json({
      valid: true,
      sitterName: user.name || 'Sitter',
      email: user.email,
    });
  } catch (error: unknown) {
    console.error('[onboard/validate] ERROR:', error);
    return NextResponse.json({ valid: false, reason: 'error' }, { status: 500 });
  }
}
