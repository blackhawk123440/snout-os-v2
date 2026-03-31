import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole } from '@/lib/rbac';

export async function GET(
  _request: NextRequest,
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
    const pet = await db.pet.findFirst({
      where: { id },
      include: {
        healthLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, type: true, note: true, createdAt: true },
        },
      },
    });

    if (!pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    // Verify sitter has/had an active booking with this pet's client
    if (pet.clientId) {
      const hasBooking = await db.booking.findFirst({
        where: {
          sitterId: ctx.sitterId,
          clientId: pet.clientId,
        },
        select: { id: true },
      });
      if (!hasBooking) {
        return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
      }
    }

    // Fetch emergency contacts
    const emergencyContacts = pet.clientId
      ? await db.clientEmergencyContact.findMany({
          where: { clientId: pet.clientId },
          select: { id: true, name: true, phone: true, relationship: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    return NextResponse.json({
      id: pet.id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      weight: pet.weight,
      gender: pet.gender,
      birthday: pet.birthday,
      color: pet.color,
      photoUrl: pet.photoUrl,
      isFixed: pet.isFixed,
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
