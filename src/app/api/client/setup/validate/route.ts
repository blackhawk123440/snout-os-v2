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
      where: { welcomeToken: token },
      select: {
        id: true,
        email: true,
        name: true,
        welcomeTokenExpiresAt: true,
        clientId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ valid: false, reason: 'invalid' });
    }

    if (user.welcomeTokenExpiresAt && new Date(user.welcomeTokenExpiresAt) < new Date()) {
      return NextResponse.json({ valid: false, reason: 'expired' });
    }

    return NextResponse.json({
      valid: true,
      clientName: user.name || 'there',
      email: user.email,
    });
  } catch (error: unknown) {
    console.error('[client/setup/validate] ERROR:', error);
    return NextResponse.json({ valid: false, reason: 'error' }, { status: 500 });
  }
}
