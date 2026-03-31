-- AI Governance updates: promptKey, promptVersion required, budget default, index
-- monthlyBudgetCents 0 = unlimited (see docs/AI_GOVERNANCE.md)

-- OrgAISettings: default monthlyBudgetCents to 0 (unlimited)
ALTER TABLE "OrgAISettings" ALTER COLUMN "monthlyBudgetCents" SET DEFAULT 0;

-- AIUsageLog: add promptKey
ALTER TABLE "AIUsageLog" ADD COLUMN "promptKey" TEXT;
UPDATE "AIUsageLog" SET "promptKey" = "featureKey" WHERE "promptKey" IS NULL;
ALTER TABLE "AIUsageLog" ALTER COLUMN "promptKey" SET NOT NULL;
ALTER TABLE "AIUsageLog" ALTER COLUMN "promptKey" SET DEFAULT '';

-- AIUsageLog: promptVersion required
UPDATE "AIUsageLog" SET "promptVersion" = 0 WHERE "promptVersion" IS NULL;
ALTER TABLE "AIUsageLog" ALTER COLUMN "promptVersion" SET NOT NULL;
ALTER TABLE "AIUsageLog" ALTER COLUMN "promptVersion" SET DEFAULT 0;

-- Add composite index for usage queries
CREATE INDEX "AIUsageLog_orgId_featureKey_createdAt_idx" ON "AIUsageLog"("orgId", "featureKey", "createdAt");
