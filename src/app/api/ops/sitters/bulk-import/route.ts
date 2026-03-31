import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { logEvent } from '@/lib/log-event';
import { env } from '@/lib/env';

const SitterRow = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(200),
  phone: z.string().max(30).optional(),
  commissionPercentage: z.number().min(0).max(100).optional(),
});

const BulkImportSchema = z.object({
  sitters: z.array(SitterRow).min(1).max(100),
});

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    const url = new URL(request.url);
    const confirm = url.searchParams.get('confirm') === 'true';

    const body = await request.json();
    const parsed = BulkImportSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });

    const rows = parsed.data.sitters;

    // Check for duplicates within the batch
    const emailSet = new Set<string>();
    const batchDuplicates: string[] = [];
    for (const row of rows) {
      const lower = row.email.toLowerCase();
      if (emailSet.has(lower)) batchDuplicates.push(row.email);
      emailSet.add(lower);
    }

    // Check for existing sitters
    const emails = rows.map(r => r.email.toLowerCase());
    const existingSitters = await (db as any).sitter.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    });
    const existingEmails = new Set(existingSitters.map((s: any) => s.email?.toLowerCase()));

    // Categorize
    const valid: typeof rows = [];
    const duplicates: Array<{ email: string; reason: string }> = [];
    const invalid: Array<{ email: string; reason: string }> = [];

    for (const row of rows) {
      const lower = row.email.toLowerCase();
      if (existingEmails.has(lower)) {
        duplicates.push({ email: row.email, reason: 'Already exists in org' });
      } else if (batchDuplicates.includes(row.email) && valid.some(v => v.email.toLowerCase() === lower)) {
        duplicates.push({ email: row.email, reason: 'Duplicate in batch' });
      } else {
        valid.push(row);
      }
    }

    // Preview mode (no confirm param)
    if (!confirm) {
      return NextResponse.json({
        preview: true,
        valid: valid.map(v => ({ firstName: v.firstName, lastName: v.lastName, email: v.email })),
        duplicates,
        invalid,
        totalValid: valid.length,
        totalDuplicates: duplicates.length,
        totalInvalid: invalid.length,
      });
    }

    // Confirm mode — create all valid sitters
    const baseUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const created: Array<{ id: string; firstName: string; lastName: string; email: string; inviteLink: string }> = [];

    await db.$transaction(async (tx: any) => {
      for (const row of valid) {
        const inviteToken = randomUUID();
        const tempHash = await bcrypt.hash(randomUUID(), 12);

        const sitter = await tx.sitter.create({
          data: {
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            phone: row.phone || '',
            commissionPercentage: row.commissionPercentage ?? 80,
            active: false,
            onboardingStatus: 'invited',
          },
        });

        await tx.user.create({
          data: {
            name: `${row.firstName} ${row.lastName}`.trim(),
            email: row.email,
            role: 'sitter',
            sitterId: sitter.id,
            passwordHash: tempHash,
            inviteToken,
            inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });

        created.push({
          id: sitter.id,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          inviteLink: `${baseUrl}/sitter/onboard?token=${inviteToken}`,
        });
      }
    });

    await logEvent({
      orgId: ctx.orgId,
      action: 'sitters.bulk_imported',
      status: 'success',
      metadata: { count: created.length, skipped: duplicates.length },
    });

    return NextResponse.json({
      created: created.length,
      skipped: duplicates.length,
      sitters: created,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[sitter-bulk-import] ERROR:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to import sitters', message }, { status: 500 });
  }
}
