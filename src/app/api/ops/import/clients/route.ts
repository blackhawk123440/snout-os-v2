/**
 * POST /api/ops/import/clients
 * Bulk import clients + pets from CSV data.
 * Owner/admin only. Deduplicates by email or phone.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { type Platform, type MappedClientRow } from '@/lib/import/field-maps';

interface ImportRow extends MappedClientRow {
  _rowIndex: number;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
  clients: Array<{ id: string; name: string; isNew: boolean }>;
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { platform, rows } = body as { platform: Platform; rows: ImportRow[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
    }

    if (rows.length > 5000) {
      return NextResponse.json({ error: 'Maximum 5000 rows per import' }, { status: 400 });
    }

    const orgId = ctx.orgId;
    const result: ImportResult = { imported: 0, skipped: 0, errors: [], clients: [] };

    // Group rows by client (email or phone) to handle multi-pet rows
    const clientMap = new Map<string, { client: ImportRow; pets: ImportRow[] }>();

    for (const row of rows) {
      const key = (row.email || row.phone || '').toLowerCase().trim();
      if (!key) {
        result.errors.push({ row: row._rowIndex, error: 'No email or phone — cannot identify client' });
        continue;
      }

      if (!row.firstName && !row.lastName) {
        result.errors.push({ row: row._rowIndex, error: 'No name provided' });
        continue;
      }

      if (clientMap.has(key)) {
        // Same client, additional pet
        clientMap.get(key)!.pets.push(row);
      } else {
        clientMap.set(key, { client: row, pets: row.petName ? [row] : [] });
      }
    }

    // Process each unique client
    for (const [dedupeKey, { client, pets }] of clientMap) {
      try {
        // Deduplication: check if client already exists by email or phone
        const existingConditions: any[] = [];
        if (client.email) existingConditions.push({ email: client.email.toLowerCase() });
        if (client.phone) existingConditions.push({ phone: client.phone });

        const existing = existingConditions.length > 0
          ? await (prisma as any).client.findFirst({
              where: { orgId, OR: existingConditions },
              select: { id: true, firstName: true, lastName: true },
            })
          : null;

        if (existing) {
          result.skipped++;
          result.clients.push({
            id: existing.id,
            name: `${existing.firstName} ${existing.lastName}`.trim(),
            isNew: false,
          });

          // Still create pets for existing clients if they have new pets
          for (const petRow of pets) {
            if (!petRow.petName) continue;
            const existingPet = await (prisma as any).pet.findFirst({
              where: { orgId, clientId: existing.id, name: petRow.petName },
              select: { id: true },
            });
            if (!existingPet) {
              await (prisma as any).pet.create({
                data: {
                  orgId,
                  clientId: existing.id,
                  name: petRow.petName,
                  species: petRow.petSpecies || null,
                  breed: petRow.petBreed || null,
                  weight: petRow.petWeight ? parseFloat(petRow.petWeight) || null : null,
                  notes: petRow.petNotes || null,
                },
              });
            }
          }
          continue;
        }

        // Create new client
        const newClient = await (prisma as any).client.create({
          data: {
            orgId,
            firstName: client.firstName || '',
            lastName: client.lastName || '',
            email: client.email?.toLowerCase() || null,
            phone: client.phone || null,
            address: client.address || null,
          },
        });

        // Create pets for the new client
        for (const petRow of pets) {
          if (!petRow.petName) continue;
          await (prisma as any).pet.create({
            data: {
              orgId,
              clientId: newClient.id,
              name: petRow.petName,
              species: petRow.petSpecies || null,
              breed: petRow.petBreed || null,
              weight: petRow.petWeight ? parseFloat(petRow.petWeight) || null : null,
              notes: petRow.petNotes || null,
            },
          });
        }

        result.imported++;
        result.clients.push({
          id: newClient.id,
          name: `${client.firstName} ${client.lastName}`.trim(),
          isNew: true,
        });
      } catch (rowError: any) {
        result.errors.push({
          row: client._rowIndex,
          error: rowError?.message || 'Failed to import',
        });
      }
    }

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('[import/clients] Error:', error);
    return NextResponse.json(
      { error: 'Import failed', message: error?.message },
      { status: 500 }
    );
  }
}
