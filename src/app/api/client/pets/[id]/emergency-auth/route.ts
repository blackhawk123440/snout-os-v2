/**
 * GET/POST /api/client/pets/[id]/emergency-auth
 * Client manages emergency vet authorization for their pet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, requireClientContext, ForbiddenError } from '@/lib/rbac';
import { prisma } from '@/lib/db';

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
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: petId } = await params;

  try {
    // Verify pet belongs to client
    const pet = await (prisma as any).pet.findFirst({
      where: { id: petId, orgId: ctx.orgId },
      select: { id: true, clientId: true, name: true, vetName: true, vetPhone: true, vetAddress: true },
    });

    if (!pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    const auth = await (prisma as any).emergencyVetAuth.findUnique({
      where: { petId },
    });

    if (!auth) {
      return NextResponse.json({
        data: null,
        petVet: { name: pet.vetName, phone: pet.vetPhone, address: pet.vetAddress },
      });
    }

    const isExpired = new Date(auth.expiresAt) < new Date();

    return NextResponse.json({
      data: {
        id: auth.id,
        authorizedUpToCents: auth.authorizedUpToCents,
        vetName: auth.vetName,
        vetPhone: auth.vetPhone,
        vetAddress: auth.vetAddress,
        additionalInstructions: auth.additionalInstructions,
        signedAt: auth.signedAt,
        signatureName: auth.signatureName,
        expiresAt: auth.expiresAt,
        isExpired,
      },
      petVet: { name: pet.vetName, phone: pet.vetPhone, address: pet.vetAddress },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to load authorization' }, { status: 500 });
  }
}

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
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: petId } = await params;

  try {
    // Verify pet belongs to client
    const pet = await (prisma as any).pet.findFirst({
      where: { id: petId, orgId: ctx.orgId },
      select: { id: true, clientId: true },
    });

    if (!pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    const body = await request.json();
    const { authorizedUpToCents, vetName, vetPhone, vetAddress, additionalInstructions, signatureName } = body;

    if (!authorizedUpToCents || authorizedUpToCents <= 0) {
      return NextResponse.json({ error: 'Authorization amount must be greater than $0' }, { status: 400 });
    }
    if (!signatureName?.trim()) {
      return NextResponse.json({ error: 'Signature name is required' }, { status: 400 });
    }

    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const auth = await (prisma as any).emergencyVetAuth.upsert({
      where: { petId },
      create: {
        orgId: ctx.orgId,
        petId,
        clientId: ctx.clientId!,
        authorizedUpToCents,
        vetName: vetName || null,
        vetPhone: vetPhone || null,
        vetAddress: vetAddress || null,
        additionalInstructions: additionalInstructions || null,
        signedAt: now,
        signatureName: signatureName.trim(),
        expiresAt: oneYearFromNow,
      },
      update: {
        authorizedUpToCents,
        vetName: vetName || null,
        vetPhone: vetPhone || null,
        vetAddress: vetAddress || null,
        additionalInstructions: additionalInstructions || null,
        signedAt: now,
        signatureName: signatureName.trim(),
        expiresAt: oneYearFromNow,
      },
    });

    return NextResponse.json({
      data: {
        id: auth.id,
        signedAt: auth.signedAt,
        expiresAt: auth.expiresAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[emergency-auth] Error:', error);
    return NextResponse.json({ error: 'Failed to save authorization' }, { status: 500 });
  }
}
