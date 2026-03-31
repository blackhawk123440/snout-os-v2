# Blocker 2: Staging DB Runbook (Booking → Thread)

When `POST /api/client/bookings` succeeds but `GET /api/messages/threads?bookingId=<id>` returns empty, lifecycle sync is failing. The most common cause on staging is missing `MessageThread` columns.

---

## 0. Recording schema proof (before and after)

- **Before fix:** Run the verify query below (or GET `/api/ops/schema-check` after deploy) and record the result (e.g. "0 rows" or "messageThread.clientApprovedAt: false").
- **After fix:** Run the same verify again and record (e.g. "2 rows" or "both true").

---

## 1. Verify columns are missing

**Option A – API (after deploy):**
```bash
curl -s -b "YOUR_OWNER_SESSION_COOKIE" "https://snout-os-staging.onrender.com/api/ops/schema-check"
```
If `messageThread.clientApprovedAt` or `messageThread.sitterApprovedAt` is `false`, columns are missing.

**Option B – Direct SQL (any Postgres client connected to staging DB):**
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'MessageThread'
  AND column_name IN ('clientApprovedAt', 'sitterApprovedAt')
ORDER BY column_name;
```
- **0 or 1 row** → at least one column missing; proceed with fix.
- **2 rows** → columns exist; check front_desk number and sync error in booking response instead.

---

## 2. Apply fix (choose one)

### Option 1: Run full migration (preferred if no conflicts)

From repo root with staging `DATABASE_URL`:
```bash
cd /path/to/repo
export DATABASE_URL="postgresql://..."   # staging connection string
npx prisma migrate deploy
```
This applies all pending migrations including `20260314030000_messaging_conversation_foundation`.

### Option 2: ALTER only MessageThread (if migration cannot run cleanly)

Run against the **staging** database (same schema as production):

```sql
-- MessageThread columns required for lifecycle sync (Blocker 2)
ALTER TABLE "MessageThread" ADD COLUMN IF NOT EXISTS "clientApprovedAt" TIMESTAMP(3);
ALTER TABLE "MessageThread" ADD COLUMN IF NOT EXISTS "sitterApprovedAt" TIMESTAMP(3);
```

If your Postgres version does not support `IF NOT EXISTS` for `ADD COLUMN`, use:
```sql
ALTER TABLE "MessageThread" ADD COLUMN "clientApprovedAt" TIMESTAMP(3);
ALTER TABLE "MessageThread" ADD COLUMN "sitterApprovedAt" TIMESTAMP(3);
```
(Ignore errors that the column already exists.)

---

## 3. Verify columns now exist

**Option A – API:**
```bash
curl -s -b "YOUR_OWNER_SESSION_COOKIE" "https://snout-os-staging.onrender.com/api/ops/schema-check"
```
Expect `messageThread.clientApprovedAt: true` and `messageThread.sitterApprovedAt: true`.

**Option B – SQL:**
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'MessageThread'
  AND column_name IN ('clientApprovedAt', 'sitterApprovedAt')
ORDER BY column_name;
```
Expect **2 rows**: `clientApprovedAt`, `sitterApprovedAt`.

---

## 4. Sync numbers (ensure org has front_desk)

As owner (e.g. e2e-login owner cookie):
```bash
curl -X POST -b "YOUR_OWNER_SESSION_COOKIE" "https://snout-os-staging.onrender.com/api/setup/numbers/sync"
```
Expect `"success": true` and `"synced": 4` (or similar).

---

## 5. Rerun proof (in order)

**A) Booking → thread proof**
```bash
BASE_URL=https://snout-os-staging.onrender.com E2E_AUTH_KEY=your-e2e-key npx tsx scripts/run-booking-thread-proof.ts
```
Expect: `linked thread exists: YES` and exit code 0.

**B) If A is green – full UAT**
```bash
BASE_URL=https://snout-os-staging.onrender.com E2E_AUTH_KEY=your-e2e-key npx tsx scripts/run-messaging-uat-validation.ts
```
Check `docs/qa/messaging-uat-results.json` for scenario pass/fail.

---

## Exact commands summary

| Step | Command |
|------|--------|
| Verify before | `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MessageThread' AND column_name IN ('clientApprovedAt', 'sitterApprovedAt');` |
| Fix (ALTER) | `ALTER TABLE "MessageThread" ADD COLUMN IF NOT EXISTS "clientApprovedAt" TIMESTAMP(3);` then same for `sitterApprovedAt` |
| Verify after | Same SELECT; expect 2 rows |
| Numbers sync | `POST /api/setup/numbers/sync` (with owner cookie) |
| Proof | `npx tsx scripts/run-booking-thread-proof.ts` then `npx tsx scripts/run-messaging-uat-validation.ts` |
