/**
 * GET /api/client/pets/[id]/timeline?cursor=&limit=20
 * Returns a unified chronological feed of all care events for a pet.
 * Client-only, scoped to their own pets.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, requireClientContext, ForbiddenError } from '@/lib/rbac';
import { prisma } from '@/lib/db';

interface TimelineItem {
  id: string;
  type: 'visit_card' | 'visit_report' | 'health_log' | 'status_change';
  date: string;
  title: string;
  summary: string;
  photoUrl?: string;
  bookingId?: string;
  metadata: Record<string, any>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: petId } = await params;
  const cursor = request.nextUrl.searchParams.get('cursor');
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '20', 10), 50);
  const cursorDate = cursor ? new Date(cursor) : new Date();

  try {
    // Verify pet belongs to client
    const pet = await (prisma as any).pet.findFirst({
      where: { id: petId, orgId: ctx.orgId },
      select: { id: true, clientId: true, name: true },
    });

    if (!pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    // Find bookings that include this pet
    const petBookings = await (prisma as any).booking.findMany({
      where: {
        orgId: ctx.orgId,
        clientId: ctx.clientId,
        pets: { some: { id: petId } },
      },
      select: { id: true },
    });
    const bookingIds = petBookings.map((b: any) => b.id);

    const items: TimelineItem[] = [];

    // 1. Visit Cards
    if (bookingIds.length > 0) {
      const visitCards = await (prisma as any).visitCard.findMany({
        where: {
          orgId: ctx.orgId,
          bookingId: { in: bookingIds },
          assembledAt: { lt: cursorDate },
        },
        orderBy: { assembledAt: 'desc' },
        take: limit,
      });

      for (const vc of visitCards) {
        const sitter = await (prisma as any).sitter.findFirst({
          where: { id: vc.sitterId, orgId: ctx.orgId },
          select: { firstName: true },
        });
        let firstPhoto: string | undefined;
        try {
          const urls = JSON.parse(vc.photoUrls || '[]');
          firstPhoto = urls[0] || undefined;
        } catch { /* ignore */ }

        items.push({
          id: `vc-${vc.id}`,
          type: 'visit_card',
          date: vc.assembledAt.toISOString(),
          title: `${sitter?.firstName || 'Sitter'}'s visit`,
          summary: vc.sitterNote?.slice(0, 100) || `${vc.durationMinutes} minute visit`,
          photoUrl: firstPhoto,
          bookingId: vc.bookingId,
          metadata: { durationMinutes: vc.durationMinutes },
        });
      }
    }

    // 2. Visit Reports
    if (bookingIds.length > 0) {
      const reports = await (prisma as any).report.findMany({
        where: {
          orgId: ctx.orgId,
          bookingId: { in: bookingIds },
          createdAt: { lt: cursorDate },
        },
        select: {
          id: true,
          bookingId: true,
          content: true,
          personalNote: true,
          mediaUrls: true,
          sitterId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      for (const r of reports) {
        let firstPhoto: string | undefined;
        try {
          const urls = JSON.parse(r.mediaUrls || '[]');
          firstPhoto = urls[0] || undefined;
        } catch { /* ignore */ }

        items.push({
          id: `rpt-${r.id}`,
          type: 'visit_report',
          date: r.createdAt.toISOString(),
          title: 'Visit report',
          summary: (r.personalNote || r.content || '').slice(0, 100),
          photoUrl: firstPhoto,
          bookingId: r.bookingId,
          metadata: {},
        });
      }
    }

    // 3. Health Logs
    const healthLogs = await (prisma as any).petHealthLog.findMany({
      where: {
        petId,
        orgId: ctx.orgId,
        createdAt: { lt: cursorDate },
      },
      select: { id: true, note: true, type: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    for (const hl of healthLogs) {
      items.push({
        id: `hl-${hl.id}`,
        type: 'health_log',
        date: hl.createdAt.toISOString(),
        title: hl.type === 'vet' ? 'Vet note' : hl.type === 'alert' ? 'Health alert' : 'Health note',
        summary: (hl.note || '').slice(0, 100),
        metadata: { logType: hl.type },
      });
    }

    // 4. Booking Status Changes
    if (bookingIds.length > 0) {
      const statusChanges = await (prisma as any).bookingStatusHistory.findMany({
        where: {
          bookingId: { in: bookingIds },
          toStatus: { in: ['confirmed', 'completed'] },
          createdAt: { lt: cursorDate },
        },
        select: {
          id: true,
          bookingId: true,
          toStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      for (const sc of statusChanges) {
        items.push({
          id: `sc-${sc.id}`,
          type: 'status_change',
          date: sc.createdAt.toISOString(),
          title: sc.toStatus === 'confirmed' ? 'Booking confirmed' : 'Visit completed',
          summary: '',
          bookingId: sc.bookingId,
          metadata: { status: sc.toStatus },
        });
      }
    }

    // Merge and sort by date descending, take top N
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Deduplicate: if a visit_card and visit_report have the same bookingId, keep only visit_card
    const seenBookings = new Set<string>();
    const deduped: TimelineItem[] = [];
    for (const item of items) {
      if (item.bookingId && item.type === 'visit_report' && seenBookings.has(item.bookingId)) {
        continue; // Skip report if visit card for same booking already included
      }
      if (item.bookingId && item.type === 'visit_card') {
        seenBookings.add(item.bookingId);
      }
      deduped.push(item);
    }

    const page = deduped.slice(0, limit);
    const nextCursor = page.length === limit ? page[page.length - 1].date : null;

    return NextResponse.json({
      items: page,
      nextCursor,
      petName: pet.name,
    });
  } catch (error: any) {
    console.error('[pet/timeline] Error:', error);
    return NextResponse.json({ error: 'Failed to load timeline' }, { status: 500 });
  }
}
