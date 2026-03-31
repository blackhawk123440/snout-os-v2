import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole } from '@/lib/rbac';

const HealthLogSchema = z.object({
  type: z.enum(['daily', 'alert', 'vet', 'allergy']),
  note: z.string().min(1).max(2000),
});

export async function POST(
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
    return NextResponse.json({ error: 'Sitter profile missing on session' }, { status: 403 });
  }

  const { id } = await params;
  const db = getScopedDb(ctx);

  try {
    const body = await request.json();
    const parsed = HealthLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Verify pet exists in this org and sitter has a booking with this pet's client
    const pet = await db.pet.findFirst({
      where: { id },
      select: { id: true, clientId: true, name: true },
    });
    if (!pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    if (pet.clientId) {
      const hasBooking = await db.booking.findFirst({
        where: { sitterId: ctx.sitterId, clientId: pet.clientId },
        select: { id: true },
      });
      if (!hasBooking) {
        return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
      }
    }

    const log = await (db.petHealthLog as any).create({
      data: {
        petId: id,
        sitterId: ctx.sitterId,
        type: parsed.data.type,
        note: parsed.data.note,
      },
    });

    // N10: Notify owner of health concern (alert or vet types)
    if (parsed.data.type === 'alert' || parsed.data.type === 'vet') {
      const sitter = await db.sitter.findUnique({
        where: { id: ctx.sitterId },
        select: { firstName: true, lastName: true },
      });
      void import('@/lib/notifications/triggers').then(({ notifyOwnerHealthConcern }) => {
        notifyOwnerHealthConcern({
          orgId: ctx.orgId,
          petId: id,
          petName: pet.name || 'Pet',
          sitterName: sitter ? `${sitter.firstName} ${sitter.lastName}`.trim() : 'Sitter',
          note: parsed.data.note,
        });
      }).catch(() => {});
    }

    return NextResponse.json(
      { id: log.id, type: log.type, note: log.note, createdAt: log.createdAt },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to add health log', message },
      { status: 500 }
    );
  }
}
