-- AI Governance: OrgAISettings, AIPromptTemplate, AIUsageLog

CREATE TABLE "OrgAISettings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "monthlyBudgetCents" INTEGER NOT NULL DEFAULT 10000,
    "hardStop" BOOLEAN NOT NULL DEFAULT false,
    "allowedModels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgAISettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgAISettings_orgId_key" ON "OrgAISettings"("orgId");

CREATE TABLE "AIPromptTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "template" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIPromptTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIPromptTemplate_orgId_key_idx" ON "AIPromptTemplate"("orgId", "key");
CREATE INDEX "AIPromptTemplate_key_idx" ON "AIPromptTemplate"("key");

CREATE TABLE "AIUsageLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "featureKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" INTEGER,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'succeeded',
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIUsageLog_orgId_idx" ON "AIUsageLog"("orgId");
CREATE INDEX "AIUsageLog_orgId_createdAt_idx" ON "AIUsageLog"("orgId", "createdAt");
CREATE INDEX "AIUsageLog_featureKey_idx" ON "AIUsageLog"("featureKey");
