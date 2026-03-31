CREATE TABLE "CommandCenterAttentionState" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "itemKey" TEXT NOT NULL,
    "handledAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommandCenterAttentionState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommandCenterAttentionState_orgId_itemKey_key"
ON "CommandCenterAttentionState"("orgId", "itemKey");

CREATE INDEX "CommandCenterAttentionState_orgId_idx"
ON "CommandCenterAttentionState"("orgId");

CREATE INDEX "CommandCenterAttentionState_orgId_handledAt_idx"
ON "CommandCenterAttentionState"("orgId", "handledAt");

CREATE INDEX "CommandCenterAttentionState_orgId_snoozedUntil_idx"
ON "CommandCenterAttentionState"("orgId", "snoozedUntil");
