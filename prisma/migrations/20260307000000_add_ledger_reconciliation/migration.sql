-- Ledger and Reconciliation

CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "stripeId" TEXT,
    "bookingId" TEXT,
    "clientId" TEXT,
    "sitterId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'succeeded',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LedgerEntry_stripeId_key" ON "LedgerEntry"("stripeId");
CREATE INDEX "LedgerEntry_orgId_occurredAt_idx" ON "LedgerEntry"("orgId", "occurredAt");
CREATE INDEX "LedgerEntry_orgId_entryType_occurredAt_idx" ON "LedgerEntry"("orgId", "entryType", "occurredAt");

CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "rangeStart" TIMESTAMP(3) NOT NULL,
    "rangeEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'succeeded',
    "totalsJson" JSONB,
    "mismatchJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReconciliationRun_orgId_idx" ON "ReconciliationRun"("orgId");
CREATE INDEX "ReconciliationRun_orgId_createdAt_idx" ON "ReconciliationRun"("orgId", "createdAt");
