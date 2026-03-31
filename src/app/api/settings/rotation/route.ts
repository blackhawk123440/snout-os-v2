import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';

const ROTATION_KEYS = [
  'poolSelectionStrategy',
  'stickyReuseDays',
  'postBookingGraceHours',
  'inactivityReleaseDays',
  'maxPoolThreadLifetimeDays',
  'minPoolReserve',
  'maxConcurrentThreadsPerPoolNumber',
  'stickyReuseKey',
] as const;

const DEFAULTS: Record<string, string> = {
  poolSelectionStrategy: 'LRU',
  stickyReuseDays: '7',
  postBookingGraceHours: '72',
  inactivityReleaseDays: '7',
  maxPoolThreadLifetimeDays: '30',
  minPoolReserve: '3',
  maxConcurrentThreadsPerPoolNumber: '1',
  stickyReuseKey: 'clientId',
};

function toDbKey(key: string): string {
  return `rotation.${key}`;
}

async function getOwnerCtx() {
  const ctx = await getRequestContext();
  requireAnyRole(ctx, ['owner', 'admin']);
  return ctx;
}

export async function GET() {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const rows = await db.setting.findMany({
      where: {
        key: { startsWith: 'rotation.' },
      },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const out: Record<string, string | number> = {};
    for (const key of ROTATION_KEYS) {
      const dbKey = toDbKey(key);
      const raw = map.get(dbKey) ?? DEFAULTS[key];
      if (key === 'stickyReuseDays' || key === 'postBookingGraceHours' || key === 'inactivityReleaseDays' || key === 'maxPoolThreadLifetimeDays' || key === 'minPoolReserve' || key === 'maxConcurrentThreadsPerPoolNumber') {
        out[key] = parseInt(raw, 10) || Number(DEFAULTS[key]);
      } else {
        out[key] = raw;
      }
    }
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw e;
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const body = await request.json().catch(() => ({}));
    const orgId = ctx.orgId;
    for (const key of ROTATION_KEYS) {
      const value = body[key];
      const str = value != null ? String(value) : DEFAULTS[key];
      const dbKey = toDbKey(key);
      await db.setting.upsert({
        where: { orgId_key: { orgId, key: dbKey } },
        create: { key: dbKey, value: str, category: 'rotation', label: key },
        update: { value: str },
      });
    }
    const rows = await db.setting.findMany({
      where: { key: { startsWith: 'rotation.' } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const out: Record<string, string | number> = {};
    for (const key of ROTATION_KEYS) {
      const dbKey = toDbKey(key);
      const raw = map.get(dbKey) ?? DEFAULTS[key];
      if (key === 'stickyReuseDays' || key === 'postBookingGraceHours' || key === 'inactivityReleaseDays' || key === 'maxPoolThreadLifetimeDays' || key === 'minPoolReserve' || key === 'maxConcurrentThreadsPerPoolNumber') {
        out[key] = parseInt(raw, 10) || Number(DEFAULTS[key]);
      } else {
        out[key] = raw;
      }
    }
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw e;
  }
}
