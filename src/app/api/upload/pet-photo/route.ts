/**
 * POST /api/upload/pet-photo
 * Upload a single pet photo. Returns the URL to store in Pet.photoUrl.
 * Reuses existing storage infrastructure (local dev / S3 prod).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionSafe } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import {
  validateReportMediaFile,
  validateReportMediaMagicBytes,
  uploadReportMedia,
  buildMediaUrl,
} from '@/lib/storage';

export async function POST(req: NextRequest) {
  const session = await getSessionSafe();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const petId = formData.get('petId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!petId) {
      return NextResponse.json({ error: 'petId is required' }, { status: 400 });
    }

    // Verify pet ownership: client must own the pet, or user must be owner/admin
    const role = session.user.role;
    if (role === 'client' && session.user.clientId) {
      const pet = await prisma.pet.findFirst({
        where: { id: petId },
        select: { booking: { select: { clientId: true } } },
      });
      if (!pet || !pet.booking?.clientId || pet.booking.clientId !== session.user.clientId) {
        return NextResponse.json({ error: 'Pet not found or not yours' }, { status: 403 });
      }
    }

    // Validate file size and type
    const validation = validateReportMediaFile(
      { size: file.size, type: file.type },
      0 // single file, no existing count
    );
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Read file buffer and validate magic bytes
    const buffer = Buffer.from(await file.arrayBuffer());
    const magicCheck = validateReportMediaMagicBytes(buffer, file.type);
    if (!magicCheck.ok) {
      return NextResponse.json({ error: magicCheck.error }, { status: 400 });
    }

    const orgId = session.user.orgId ?? 'default';

    // Upload using existing storage layer (uses petId as the "bookingId" subfolder)
    const key = await uploadReportMedia(buffer, file.type, orgId, `pets/${petId}`);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const url = buildMediaUrl(key, baseUrl);

    return NextResponse.json({ url });
  } catch (error) {
    console.error('[PetPhoto] Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
