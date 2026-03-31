-- Add org scope to config/policy tiers
ALTER TABLE "SitterTier" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "SitterTierHistory" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default';

-- Backfill tier history org scope from sitter orgId where available
UPDATE "SitterTierHistory" h
SET "orgId" = s."orgId"
FROM "Sitter" s
WHERE h."sitterId" = s."id";

-- Replace global uniqueness with org-scoped uniqueness
DROP INDEX IF EXISTS "SitterTier_name_key";
CREATE UNIQUE INDEX "SitterTier_orgId_name_key" ON "SitterTier"("orgId", "name");

-- Add org indexes for scoped queries
CREATE INDEX "SitterTier_orgId_idx" ON "SitterTier"("orgId");
CREATE INDEX "SitterTierHistory_orgId_idx" ON "SitterTierHistory"("orgId");
CREATE INDEX "SitterTierHistory_orgId_sitterId_idx" ON "SitterTierHistory"("orgId", "sitterId");
