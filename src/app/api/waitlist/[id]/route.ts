import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';

const WAITLIST_KEY = 'waitlist_entries';

interface WaitlistEntry {
  id: string;
  orgId: string;
  clientId: string;
  clientName: string;
  service: string;
  preferredDate: string;
  preferredTimeStart: string;
  preferredTimeEnd: string;
  notes: string;
  status: 'waiting' | 'notified' | 'booked' | 'expired';
  createdAt: string;
}

async function loadEntries(db: ReturnType<typeof getScopedDb>, orgId: string): Promise<WaitlistEntry[]> {
  const row = await (db as any).setting.findFirst({
    where: { key: WAITLIST_KEY },
  });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveEntries(
  db: ReturnType<typeof getScopedDb>,
  orgId: string,
  entries: WaitlistEntry[],
): Promise<void> {
  await (db as any).setting.upsert({
    where: { orgId_key: { orgId, key: WAITLIST_KEY } },
    create: {
      orgId,
      key: WAITLIST_KEY,
      value: JSON.stringify(entries),
      category: 'waitlist',
      label: 'Waitlist Entries',
    },
    update: {
      value: JSON.stringify(entries),
    },
  });
}

/**
 * DELETE /api/waitlist/[id] — remove an entry from the waitlist
 * Clients can only delete their own entries; owners/admins can delete any.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin', 'client']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const db = getScopedDb(ctx);
    const entries = await loadEntries(db, ctx.orgId);
    const idx = entries.findIndex((e) => e.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Clients can only remove their own entries
    if (ctx.role === 'client' && entries[idx].clientId !== ctx.clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    entries.splice(idx, 1);
    await saveEntries(db, ctx.orgId, entries);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to remove from waitlist', message },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/waitlist/[id] — update entry status
 * Accepts { status: 'notified' | 'booked' | 'expired' }
 * Only owners/admins can update status.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const validStatuses = ['notified', 'booked', 'expired'] as const;
    const newStatus = body?.status as string | undefined;

    if (!newStatus || !validStatuses.includes(newStatus as (typeof validStatuses)[number])) {
      return NextResponse.json(
        { error: 'status must be one of: notified, booked, expired' },
        { status: 400 },
      );
    }

    const db = getScopedDb(ctx);
    const entries = await loadEntries(db, ctx.orgId);
    const entry = entries.find((e) => e.id === id);

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    entry.status = newStatus as WaitlistEntry['status'];
    await saveEntries(db, ctx.orgId, entries);

    return NextResponse.json({ entry });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update waitlist entry', message },
      { status: 500 },
    );
  }
}
