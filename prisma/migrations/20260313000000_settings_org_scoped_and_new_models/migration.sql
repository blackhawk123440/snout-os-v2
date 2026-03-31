-- Settings consolidation: org-scope settings models and new notification/service-area tables

-- Setting: add orgId, replace key unique with (orgId, key)
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "orgId" TEXT NOT NULL DEFAULT 'default';
DROP INDEX IF EXISTS "Setting_key_key";
CREATE UNIQUE INDEX "Setting_orgId_key_key" ON "Setting"("orgId", "key");
CREATE INDEX IF NOT EXISTS "Setting_orgId_idx" ON "Setting"("orgId");

-- ServiceConfig: add orgId, replace serviceName unique with (orgId, serviceName)
ALTER TABLE "ServiceConfig" ADD COLUMN IF NOT EXISTS "orgId" TEXT NOT NULL DEFAULT 'default';
DROP INDEX IF EXISTS "ServiceConfig_serviceName_key";
CREATE UNIQUE INDEX "ServiceConfig_orgId_serviceName_key" ON "ServiceConfig"("orgId", "serviceName");
CREATE INDEX IF NOT EXISTS "ServiceConfig_orgId_idx" ON "ServiceConfig"("orgId");

-- PricingRule: add orgId
ALTER TABLE "PricingRule" ADD COLUMN IF NOT EXISTS "orgId" TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS "PricingRule_orgId_idx" ON "PricingRule"("orgId");

-- Discount: add orgId, replace code unique with (orgId, code). Existing rows with duplicate code in same org may need manual deduplication.
ALTER TABLE "Discount" ADD COLUMN IF NOT EXISTS "orgId" TEXT NOT NULL DEFAULT 'default';
DROP INDEX IF EXISTS "Discount_code_key";
CREATE UNIQUE INDEX "Discount_orgId_code_key" ON "Discount"("orgId", "code");
CREATE INDEX IF NOT EXISTS "Discount_orgId_idx" ON "Discount"("orgId");

-- BusinessSettings: add orgId, one row per org
ALTER TABLE "BusinessSettings" ADD COLUMN IF NOT EXISTS "orgId" TEXT NOT NULL DEFAULT 'default';
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessSettings_orgId_key" ON "BusinessSettings"("orgId");
CREATE INDEX IF NOT EXISTS "BusinessSettings_orgId_idx" ON "BusinessSettings"("orgId");

-- OrgNotificationSettings (new)
CREATE TABLE "OrgNotificationSettings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ownerAlerts" BOOLEAN NOT NULL DEFAULT true,
    "sitterNotifications" BOOLEAN NOT NULL DEFAULT true,
    "clientReminders" BOOLEAN NOT NULL DEFAULT true,
    "paymentReminders" BOOLEAN NOT NULL DEFAULT true,
    "conflictNoticeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderTiming" TEXT DEFAULT '24h',
    "preferences" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgNotificationSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrgNotificationSettings_orgId_key" ON "OrgNotificationSettings"("orgId");
CREATE INDEX "OrgNotificationSettings_orgId_idx" ON "OrgNotificationSettings"("orgId");

-- OrgServiceArea (new)
CREATE TABLE "OrgServiceArea" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgServiceArea_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrgServiceArea_orgId_idx" ON "OrgServiceArea"("orgId");
