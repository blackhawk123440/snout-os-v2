-- PayrollRun: add orgId for multi-tenant payroll (required for /payroll)
ALTER TABLE "PayrollRun" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default';

-- Drop legacy single-column indexes
DROP INDEX IF EXISTS "PayrollRun_payPeriodStart_idx";
DROP INDEX IF EXISTS "PayrollRun_payPeriodEnd_idx";
DROP INDEX IF EXISTS "PayrollRun_status_idx";

-- Org-scoped indexes
CREATE INDEX "PayrollRun_orgId_idx" ON "PayrollRun"("orgId");
CREATE INDEX "PayrollRun_orgId_payPeriodStart_idx" ON "PayrollRun"("orgId", "payPeriodStart");
CREATE INDEX "PayrollRun_orgId_payPeriodEnd_idx" ON "PayrollRun"("orgId", "payPeriodEnd");
CREATE INDEX "PayrollRun_orgId_status_idx" ON "PayrollRun"("orgId", "status");
