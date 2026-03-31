/**
 * POST /api/upload/report-media
 * Upload 1-5 images for a Daily Delight report.
 * Body: multipart/form-data with "files" (or "file") and "bookingId"
 * Requires: sitter/owner/admin, org-scoped, booking must belong to org and sitter
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, assertOrgAccess, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import {
  uploadReportMedia,
  validateReportMediaFile,
  validateReportMediaMagicBytes,
  getMaxFiles,
  buildMediaUrl,
} from '@/lib/storage';
import { log } from '@/lib/logger';

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin', 'sitter']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const bookingId = formData.get('bookingId') as string | null;
  if (!bookingId) {
    return NextResponse.json(
      { error: 'bookingId required' },
      { status: 400 }
    );
  }

  const db = getScopedDb(ctx);
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, orgId: true, sitterId: true },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  try {
    assertOrgAccess(booking.orgId, ctx.orgId);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (ctx.role === 'sitter' && ctx.sitterId && booking.sitterId !== ctx.sitterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const orgId = booking.orgId || ctx.orgId || 'default';

  const files: File[] = [];
  const fileInput = formData.getAll('files');
  const singleFile = formData.get('file');
  if (Array.isArray(fileInput)) {
    fileInput.forEach((f) => {
      if (f instanceof File) files.push(f);
    });
  }
  if (singleFile instanceof File) {
    files.push(singleFile);
  }

  if (files.length === 0) {
    return NextResponse.json(
      { error: 'At least one file required' },
      { status: 400 }
    );
  }

  if (files.length > getMaxFiles()) {
    return NextResponse.json(
      { error: `Maximum ${getMaxFiles()} files allowed` },
      { status: 400 }
    );
  }

  const urls: string[] = [];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const validation = validateReportMediaFile(
      { size: file.size, type: file.type },
      i
    );
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const magicValidation = validateReportMediaMagicBytes(buffer, file.type);
    if (!magicValidation.ok) {
      log.warn('Upload rejected: magic byte mismatch', {
        orgId,
        route: '/api/upload/report-media',
        error: magicValidation.error,
      });
      return NextResponse.json(
        { error: magicValidation.error },
        { status: 400 }
      );
    }

    const key = await uploadReportMedia(buffer, file.type, orgId, bookingId);
    urls.push(buildMediaUrl(key, baseUrl));
  }

  return NextResponse.json({ urls });
}
