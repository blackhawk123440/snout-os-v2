# Snout OS — Operations Checklist

Pre-launch operational requirements and procedures.

---

## CRITICAL: Database Backups

### Option A: Render Managed Backups (Recommended)

**Action:** Upgrade Render PostgreSQL from Starter to Standard plan ($20/mo).

Standard plan includes:
- Automated daily backups with 7-day retention
- Point-in-time recovery (PITR) to any second in the last 7 days
- Automated failover for high availability

**Steps:**
1. Go to Render Dashboard > your PostgreSQL instance
2. Click "Change Plan" > select "Standard"
3. Confirm the upgrade (no downtime — Render migrates in place)
4. Verify: Dashboard should show "Backups: Enabled" within 24 hours

### Option B: Self-Managed Backups to S3

If staying on Starter plan, add a daily pg_dump cron job:

**Add to render.yaml:**
```yaml
- type: cron
  name: snout-db-backup
  schedule: "0 4 * * *"  # 4 AM UTC daily
  buildCommand: ""
  startCommand: |
    pg_dump $DATABASE_URL --format=custom --no-owner \
      | aws s3 cp - s3://$S3_BUCKET/backups/snout-$(date +%Y%m%d-%H%M%S).dump
  envVars:
    - key: DATABASE_URL
      fromDatabase:
        name: snout-db
        property: connectionString
    - key: S3_BUCKET
      fromGroup: snout-env
    - key: AWS_ACCESS_KEY_ID
      fromGroup: snout-env
    - key: AWS_SECRET_ACCESS_KEY
      fromGroup: snout-env
```

**Retention:** Add an S3 lifecycle rule to expire backup objects after 30 days.

---

## Backup Verification Procedure

Run monthly to verify backups are restorable:

1. **Download latest backup:**
   ```bash
   # Render managed:
   render pg:backups:download --database snout-db --output backup.dump
   
   # S3 managed:
   aws s3 cp s3://$S3_BUCKET/backups/$(aws s3 ls s3://$S3_BUCKET/backups/ | sort | tail -1 | awk '{print $4}') backup.dump
   ```

2. **Restore to a test database:**
   ```bash
   createdb snout_restore_test
   pg_restore --dbname=snout_restore_test --no-owner backup.dump
   ```

3. **Verify data integrity:**
   ```bash
   psql snout_restore_test -c "SELECT count(*) FROM \"Booking\";"
   psql snout_restore_test -c "SELECT count(*) FROM \"User\";"
   psql snout_restore_test -c "SELECT count(*) FROM \"Client\";"
   psql snout_restore_test -c "SELECT count(*) FROM \"MessageThread\";"
   ```

4. **Clean up:**
   ```bash
   dropdb snout_restore_test
   ```

5. **Log result** in the team's ops channel with date and row counts.

---

## Rollback Procedure

### Scenario: Bad deploy broke the application

1. **Identify the last good deploy** in Render dashboard (Deploys tab)
2. Click "Manual Deploy" on the last good commit SHA
3. Render will rebuild and redeploy from that commit
4. Verify health: `curl https://your-app.onrender.com/api/health`

### Scenario: Bad migration corrupted data

1. **Stop the web + worker services** in Render dashboard (prevents further writes)
2. **Restore from backup:**
   ```bash
   # Render managed (PITR):
   # Go to Render Dashboard > PostgreSQL > Backups > Restore to Point in Time
   # Select timestamp BEFORE the bad migration ran
   
   # S3 managed:
   pg_restore --dbname=$DATABASE_URL --clean --no-owner backup.dump
   ```
3. **Redeploy the previous commit** (before the bad migration)
4. **Restart web + worker services**
5. **Verify data integrity** using the verification procedure above

### Scenario: Need to revert a Prisma migration

```bash
# 1. Check which migration to revert
npx prisma migrate status

# 2. Mark the migration as rolled back
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# 3. Apply the corrected schema
npx prisma migrate dev --name fix_MIGRATION_NAME
```

---

## Monitoring & Alerting

| System | Tool | What it monitors |
|--------|------|-----------------|
| Application errors | Sentry | Unhandled exceptions, API 500s |
| Uptime | Render health checks | `/api/health` — DB + Redis + workers |
| Queue health | Admin portal | `/admin/health` — BullMQ queue status |
| Financial integrity | Reconciliation worker | Daily 2 AM pricing drift detection |
| Calendar sync | Inbound poll | Every 15 min Google Calendar check |

### Alert Response

- **Sentry alert (P0 error):** Check `/admin/health` for system status, then Sentry issue for stack trace
- **Health check failure:** Check Render dashboard for service status, Redis/DB connectivity
- **Reconciliation drift:** Check `/admin/billing` for financial summary, then `/ops/finance/reconciliation` for drift details
- **Queue backlog:** Check `/admin/health` for queue pending counts. If > 100 pending, restart worker service.

---

## Pre-Launch Verification

Before enabling real user signups:

- [ ] PostgreSQL upgraded to Standard plan (or S3 backup cron configured)
- [ ] Backup verified restorable (run verification procedure once)
- [ ] Sentry DSN configured and receiving test errors
- [ ] Health endpoint returns 200 with all services "ok"
- [ ] Stripe webhook endpoint verified (send test webhook from Stripe dashboard)
- [ ] Twilio webhook URL configured and verified
- [ ] NEXTAUTH_SECRET is a real random value (not dev fallback)
- [ ] All NEXT_PUBLIC_ vars contain only public-safe values
- [ ] DNS + SSL configured for production domain
- [ ] Cookie consent banner visible on first visit
- [ ] Terms of Service and Privacy Policy pages accessible
- [ ] Client data export works (test from client portal)
- [ ] Admin portal accessible at /admin (superadmin role only)
