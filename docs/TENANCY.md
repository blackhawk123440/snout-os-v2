# Multi-Tenant Org Isolation (Batch 7)

This document describes how tenant isolation is enforced at the data access layer so cross-org leaks become mechanically impossible.

## Tenant-Owned Models

Models with `orgId` in the Prisma schema are **tenant-owned**. All reads and writes for these models **must** be org-scoped.

The canonical list lives in `src/lib/tenancy/tenant-models.ts`:

- `booking`, `client`, `pet`, `sitter`, `report`, `messageThread`, `messageEvent`, `stripeCharge`, `eventLog`, etc.
- See `TENANT_MODELS` for the full list.

## Using getScopedDb

**Never** import `prisma` directly in API routes. Use `getScopedDb(ctx)` instead:

```ts
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';

export async function GET() {
  const ctx = await getRequestContext();
  const db = getScopedDb(ctx);

  const threads = await db.messageThread.findMany({
    where: { status: 'active' },
    // orgId is injected automatically
  });
  return NextResponse.json(threads);
}
```

### Requirements

- `ctx` must have `orgId: string`. If missing, `getScopedDb` throws `InvariantError` 403.
- For routes using session: `const orgId = (session.user as any).orgId ?? 'default'` then `getScopedDb({ orgId })`.

## How It Works

The scoped client is a **proxy** around Prisma that:

1. **findMany / findFirst / findUnique**: Merges `orgId` into the `where` clause.
2. **create / createMany**: Sets `orgId` in `data` (rejects if `data.orgId` conflicts with ctx).
3. **update / delete / upsert / updateMany / deleteMany**: Merges `orgId` into the `where` clause.

### findUnique Handling

Prisma `findUnique` uses unique constraints (often `id` only), which can bypass org scoping. The scoped client **converts** `findUnique` to `findFirst` with `where: { id, orgId }`, so tenant isolation is preserved.

## Common Pitfalls

1. **Using raw prisma in app/api**: Use `getScopedDb(ctx)` instead. CI will fail if you import `@/lib/db` in route files.
2. **Passing orgId in create data**: The scoped client sets it. If you pass a different `orgId`, it throws.
3. **Webhooks without session**: Webhooks (e.g. Stripe) get `orgId` from the event payload. Use `getScopedDb({ orgId })` with that value.
4. **$transaction**: Use the callback form. The transaction client passed to your callback is also scoped.

## Migration Pattern

Replace:

```ts
import { prisma } from '@/lib/db';
// ...
const items = await prisma.booking.findMany({
  where: whereOrg(ctx.orgId, { status: 'confirmed' }),
});
```

With:

```ts
import { getScopedDb } from '@/lib/tenancy';
// ...
const db = getScopedDb(ctx);
const items = await db.booking.findMany({
  where: { status: 'confirmed' },
});
```

Remove manual `whereOrg` calls; the scoped client injects `orgId` automatically.

## CI Guard

Run `pnpm run check:no-raw-prisma` to ensure no API route imports raw prisma. Migration is incremental; the check runs in CI (allowed to fail until full migration).
