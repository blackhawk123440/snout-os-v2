import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';

export async function GET() {
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

  try {
    const db = getScopedDb(ctx);

    const allPets = await db.pet.findMany({
      where: { clientId: ctx.clientId, isActive: true },
      select: {
        id: true, name: true, species: true, breed: true, weight: true,
        photoUrl: true, updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    // Deduplicate by name+species (take most recently updated)
    const seen = new Map<string, typeof allPets[0]>();
    for (const p of allPets) {
      const key = `${(p.name || '').toLowerCase()}::${(p.species || '').toLowerCase()}`;
      if (!seen.has(key)) {
        seen.set(key, p);
      }
    }

    const pets = Array.from(seen.values())
      .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

    return NextResponse.json({
      pets: pets.map((p: any) => ({
        id: p.id,
        name: p.name,
        species: p.species,
        breed: p.breed,
        weight: p.weight,
        photoUrl: p.photoUrl,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load pets', message },
      { status: 500 }
    );
  }
}

const CreatePetSchema = z.object({
  name: z.string().min(1).max(100),
  species: z.string().min(1).max(50),
  breed: z.string().max(100).optional(),
  weight: z.number().min(0).max(500).optional(),
  gender: z.enum(['male', 'female', 'unknown']).optional(),
  birthday: z.string().optional(),
  color: z.string().max(100).optional(),
  microchipId: z.string().max(100).optional(),
  isFixed: z.boolean().optional(),
  photoUrl: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
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

  try {
    const db = getScopedDb(ctx);

    const body = await request.json();
    const parsed = CreatePetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const pet = await db.pet.create({
      data: {
        clientId: ctx.clientId,
        name: data.name,
        species: data.species,
        breed: data.breed || null,
        weight: data.weight ?? null,
        gender: data.gender || null,
        birthday: data.birthday ? new Date(data.birthday) : null,
        color: data.color || null,
        microchipId: data.microchipId || null,
        isFixed: data.isFixed ?? false,
        photoUrl: data.photoUrl || null,
      },
    });

    return NextResponse.json({ id: pet.id, name: pet.name, species: pet.species }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create pet', message },
      { status: 500 }
    );
  }
}
