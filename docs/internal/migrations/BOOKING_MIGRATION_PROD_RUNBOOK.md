# Booking Migration Production Runbook (Approved Path)

Status: migration logic approved and frozen.  
Rule: do not redesign migration logic unless a concrete production blocker is found.

## A. Preflight checklist

- [ ] Confirm you are in the correct repo and branch with approved migration scripts.
- [ ] Confirm target DB connection and org:
  - `DATABASE_URL` points to intended target DB
  - `MIGRATION_TARGET_ORG_ID` is correct (`default` unless explicitly overridden)
- [ ] Confirm source endpoint reachability:
  - `https://backend-291r.onrender.com/api/bookings`
  - `https://backend-291r.onrender.com/api/sitters`
- [ ] Confirm Prisma connectivity and schema compatibility:
  - `npx prisma migrate status`
  - `node -e 'const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); (async()=>{await p.$queryRaw\`SELECT 1\`; console.log("ok"); await p.$disconnect();})();'`
- [ ] Confirm **backup completed** (required, not optional):
  - Render snapshot or SQL export completed and timestamp recorded.
- [ ] Confirm write-window approval and rollback owner on standby.

## B. Required env vars

- `DATABASE_URL` (required): target Postgres for NEW dashboard.
- `MIGRATION_TARGET_ORG_ID` (optional, defaults to `default`): org to write migrated records into.
- `OLD_DASHBOARD_URL` (optional, defaults to `https://backend-291r.onrender.com`): source API base URL.

Runtime assumptions:
- Prisma schema in runtime matches `prisma/schema.prisma`.
- OLD API remains readable for bookings/sitters.
- Booking IDs from OLD are safe to reuse in NEW (current model supports direct ID insert).

## C. Exact command sequence

### 1) Backup (required before live run)

```bash
# Example SQL export backup (operator machine)
mkdir -p "$HOME/booking-migration-backups"
pg_dump "$DATABASE_URL" -Fc -f "$HOME/booking-migration-backups/snout-os-pre-migration-$(date +%Y%m%d-%H%M%S).dump"
```

### 2) Clean rerun

```bash
rm -f docs/internal/audit/artifacts/booking-migration/checkpoint.json
```

### 3) Apply

```bash
npx tsx scripts/migrate-old-dashboard-bookings.ts --apply
```

### 4) Verify

```bash
npx tsx scripts/verify-old-dashboard-bookings-migration.ts
```

### 5) Artifact review

```bash
ls -lh docs/internal/audit/artifacts/booking-migration/
cat docs/internal/audit/artifacts/booking-migration/summary.json
cat docs/internal/audit/artifacts/booking-migration/verification-report.json
cat docs/internal/audit/artifacts/booking-migration/failures.json
cat docs/internal/audit/artifacts/booking-migration/mismatches.json
```

### 6) Archive artifacts outside repo

```bash
mkdir -p "$HOME/booking-migration-artifacts/$(date +%Y%m%d-%H%M%S)"
cp docs/internal/audit/artifacts/booking-migration/summary.json "$HOME/booking-migration-artifacts/$(date +%Y%m%d-%H%M%S)/" 2>/dev/null || true
cp docs/internal/audit/artifacts/booking-migration/verification-report.json "$HOME/booking-migration-artifacts/$(date +%Y%m%d-%H%M%S)/" 2>/dev/null || true
cp docs/internal/audit/artifacts/booking-migration/failures.json "$HOME/booking-migration-artifacts/$(date +%Y%m%d-%H%M%S)/" 2>/dev/null || true
cp docs/internal/audit/artifacts/booking-migration/mismatches.json "$HOME/booking-migration-artifacts/$(date +%Y%m%d-%H%M%S)/" 2>/dev/null || true
cp docs/internal/audit/artifacts/booking-migration/migration-log.jsonl "$HOME/booking-migration-artifacts/$(date +%Y%m%d-%H%M%S)/" 2>/dev/null || true
```

## D. Rollback / backout plan

- Primary rollback: restore pre-run DB backup/snapshot.
- If restore is not needed and issue is scoped:
  - isolate affected booking IDs from `migration-log.jsonl` and verification reports.
  - run targeted delete/repair in controlled maintenance window.
- Always preserve exported source artifacts and logs for audit trail.

## E. Post-run validation checklist

Manual UI spot-check 5–10 migrated bookings in NEW dashboard:

- [ ] dates/times
- [ ] customer name/phone
- [ ] sitter assignment
- [ ] pets
- [ ] time slots
- [ ] price
- [ ] notes
- [ ] payment status
- [ ] booking status

Also confirm from artifacts:
- [ ] `summary.json`: `failures=0`, `mismatches=0`
- [ ] `verification-report.json`: `missingInTargetCount=0`, `mismatchCount=0`

## F. Production risks to confirm before pressing go

- `DATABASE_URL` points to intended production DB (not staging).
- `MIGRATION_TARGET_ORG_ID` is correct for production tenant.
- Production schema/migrations are fully applied (no drift).
- Production constraints/triggers match staging expectations.
- Backup is complete, restorable, and restore owner is identified.
- OLD API still serves complete booking payloads during run window.

