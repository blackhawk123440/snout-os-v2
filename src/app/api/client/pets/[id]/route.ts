import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';

export async function GET(
  _request: NextRequest,
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

    const pet = await db.pet.findFirst({
      where: { id, clientId: ctx.clientId },
      include: {
        healthLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            type: true,
            note: true,
            createdAt: true,
          },
        },
      },
    });

    if (!pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    // Fetch client's emergency contacts
    const emergencyContacts = await db.clientEmergencyContact.findMany({
      where: { clientId: ctx.clientId },
      select: { id: true, name: true, phone: true, relationship: true },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      id: pet.id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      age: pet.age,
      weight: pet.weight,
      gender: pet.gender,
      birthday: pet.birthday,
      color: pet.color,
      microchipId: pet.microchipId,
      isFixed: pet.isFixed,
      photoUrl: pet.photoUrl,
      feedingInstructions: pet.feedingInstructions,
      medicationNotes: pet.medicationNotes,
      behaviorNotes: pet.behaviorNotes,
      houseRules: pet.houseRules,
      walkInstructions: pet.walkInstructions,
      vetName: pet.vetName,
      vetPhone: pet.vetPhone,
      vetAddress: pet.vetAddress,
      vetClinicName: pet.vetClinicName,
      notes: pet.notes,
      healthLogs: pet.healthLogs,
      emergencyContacts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load pet', message },
      { status: 500 }
    );
  }
}

const UpdatePetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  species: z.string().min(1).max(50).optional(),
  breed: z.string().max(100).optional().nullable(),
  weight: z.number().min(0).max(500).optional().nullable(),
  gender: z.enum(['male', 'female', 'unknown']).optional().nullable(),
  birthday: z.string().optional().nullable(),
  color: z.string().max(100).optional().nullable(),
  microchipId: z.string().max(100).optional().nullable(),
  isFixed: z.boolean().optional(),
  photoUrl: z.string().max(2000).optional().nullable(),
  feedingInstructions: z.string().max(2000).optional().nullable(),
  medicationNotes: z.string().max(2000).optional().nullable(),
  behaviorNotes: z.string().max(2000).optional().nullable(),
  houseRules: z.string().max(2000).optional().nullable(),
  walkInstructions: z.string().max(2000).optional().nullable(),
  vetName: z.string().max(200).optional().nullable(),
  vetPhone: z.string().max(50).optional().nullable(),
  vetAddress: z.string().max(500).optional().nullable(),
  vetClinicName: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function PATCH(
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
    const parsed = UpdatePetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    const fields = parsed.data;
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        if (key === 'birthday' && value) {
          data[key] = new Date(value as string);
        } else {
          data[key] = value;
        }
      }
    }

    const updated = await db.$transaction(async (tx) => {
      // Verify ownership
      const existing = await tx.pet.findFirst({
        where: { id, clientId: ctx.clientId },
        select: { id: true },
      });
      if (!existing) {
        return null;
      }

      return tx.pet.update({
        where: { id },
        data,
      });
    });

    if (!updated) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      species: updated.species,
      breed: updated.breed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update pet', message },
      { status: 500 }
    );
  }
}
