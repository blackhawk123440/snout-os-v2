/**
 * GET /api/sitter/reports/[id]
 * Returns a report for editing (sitter must own the booking). Requires SITTER role.
 *
 * PATCH /api/sitter/reports/[id]
 * Update a report (content, mediaUrls) if within 15 minutes of creation. Requires SITTER role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole } from '@/lib/rbac';

const EDIT_WINDOW_MS = 15 * 60 * 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });
  }

  const { id: reportId } = await params;
  const db = getScopedDb(ctx);

  const report = await db.report.findFirst({
    where: { id: reportId },
    include: { booking: { select: { sitterId: true } } },
  });

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }
  if (report.booking?.sitterId !== ctx.sitterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const toIso = (d: Date) => (d instanceof Date ? d.toISOString() : String(d));
  const mediaUrls = typeof report.mediaUrls === 'string'
    ? (() => { try { return JSON.parse(report.mediaUrls) as string[]; } catch { return []; } })()
    : [];

  return NextResponse.json({
    id: report.id,
    content: report.content,
    mediaUrls,
    createdAt: toIso(report.createdAt),
    canEdit: Date.now() - (report.createdAt instanceof Date ? report.createdAt.getTime() : new Date(report.createdAt).getTime()) <= EDIT_WINDOW_MS,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });
  }

  const { id: reportId } = await params;
  let body: { content?: string; mediaUrls?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const db = getScopedDb(ctx);
  const report = await db.report.findFirst({
    where: { id: reportId },
    include: { booking: { select: { sitterId: true } } },
  });

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }
  if (report.booking?.sitterId !== ctx.sitterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const createdAt = report.createdAt instanceof Date ? report.createdAt.getTime() : new Date(report.createdAt).getTime();
  if (Date.now() - createdAt > EDIT_WINDOW_MS) {
    return NextResponse.json({ error: 'Report can only be edited within 15 minutes of submission' }, { status: 400 });
  }

  const content = typeof body.content === 'string' ? body.content.trim() : report.content;
  const mediaUrls = Array.isArray(body.mediaUrls)
    ? body.mediaUrls.filter((u): u is string => typeof u === 'string').slice(0, 5)
    : null;

  await db.report.update({
    where: { id: reportId },
    data: {
      content: content || report.content,
      mediaUrls: mediaUrls !== null ? JSON.stringify(mediaUrls) : report.mediaUrls,
    },
  });

  return NextResponse.json({ ok: true });
}
