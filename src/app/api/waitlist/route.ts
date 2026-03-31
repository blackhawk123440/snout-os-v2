import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { randomUUID } from 'crypto';

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
 * GET /api/waitlist — list waitlist entries for the org
 */
export async function GET() {
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

  try {
    const db = getScopedDb(ctx);
    const entries = await loadEntries(db, ctx.orgId);

    // Clients only see their own entries
    const visible =
      ctx.role === 'client'
        ? entries.filter((e) => e.clientId === ctx.clientId)
        : entries;

    const result = visible.map((e, idx) => ({
      id: e.id,
      clientId: e.clientId,
      clientName: e.clientName,
      service: e.service,
      preferredDate: e.preferredDate,
      preferredTimeStart: e.preferredTimeStart,
      preferredTimeEnd: e.preferredTimeEnd,
      notes: e.notes,
      status: e.status,
      position: idx + 1,
      createdAt: e.createdAt,
    }));

    return NextResponse.json({ entries: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load waitlist', message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/waitlist — add an entry to the waitlist
 */
export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json().catch(() => ({}));
    const {
      clientId,
      service,
      preferredDate,
      preferredTimeStart,
      preferredTimeEnd,
      notes,
    } = body as Record<string, string | undefined>;

    if (!service) {
      return NextResponse.json({ error: 'service is required' }, { status: 400 });
    }

    // Clients can only add themselves; owners/admins must supply clientId
    const resolvedClientId =
      ctx.role === 'client' ? ctx.clientId : clientId;

    if (!resolvedClientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    // Look up the client name
    const db = getScopedDb(ctx);
    const client = await (db as any).client.findFirst({
      where: { id: resolvedClientId },
      select: { firstName: true, lastName: true },
    });
    const clientName = client
      ? [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Unknown'
      : 'Unknown';

    const entries = await loadEntries(db, ctx.orgId);

    const newEntry: WaitlistEntry = {
      id: randomUUID(),
      orgId: ctx.orgId,
      clientId: resolvedClientId,
      clientName,
      service,
      preferredDate: preferredDate || '',
      preferredTimeStart: preferredTimeStart || '',
      preferredTimeEnd: preferredTimeEnd || '',
      notes: notes || '',
      status: 'waiting',
      createdAt: new Date().toISOString(),
    };

    entries.push(newEntry);
    await saveEntries(db, ctx.orgId, entries);

    return NextResponse.json({
      entry: {
        ...newEntry,
        position: entries.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to add to waitlist', message },
      { status: 500 },
    );
  }
}
