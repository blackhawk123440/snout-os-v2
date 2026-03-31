import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';

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
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const db = getScopedDb(ctx);

    const body = await request.json();
    const parsed = HealthLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      // Verify pet belongs to client
      const pet = await tx.pet.findFirst({
        where: { id, clientId: ctx.clientId },
        select: { id: true, name: true },
      });
      if (!pet) {
        return null;
      }

      const log = await (tx.petHealthLog as any).create({
        data: {
          petId: id,
          type: parsed.data.type,
          note: parsed.data.note,
        },
      });

      return { log, petName: (pet as any).name || 'Pet' };
    });

    if (!result) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    // N10: Notify owner of health concern (alert or vet types)
    if (parsed.data.type === 'alert' || parsed.data.type === 'vet') {
      void import('@/lib/notifications/triggers').then(({ notifyOwnerHealthConcern }) => {
        notifyOwnerHealthConcern({
          orgId: ctx.orgId,
          petId: id,
          petName: result.petName,
          sitterName: 'Client',
          note: parsed.data.note,
        });
      }).catch(() => {});
    }

    return NextResponse.json(
      { id: result.log.id, type: result.log.type, note: result.log.note, createdAt: result.log.createdAt },
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
