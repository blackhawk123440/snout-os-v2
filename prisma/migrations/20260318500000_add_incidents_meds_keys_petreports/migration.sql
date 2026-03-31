-- Pet: add structured medications
ALTER TABLE "Pet" ADD COLUMN "medications" TEXT;

-- Report: add petReports JSON
ALTER TABLE "Report" ADD COLUMN "petReports" TEXT;

-- Client: add key tracking
ALTER TABLE "Client" ADD COLUMN "keyStatus" TEXT DEFAULT 'none';
ALTER TABLE "Client" ADD COLUMN "keyHolder" TEXT;
ALTER TABLE "Client" ADD COLUMN "keyNotes" TEXT;
ALTER TABLE "Client" ADD COLUMN "keyGivenAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN "keyReturnedAt" TIMESTAMP(3);

-- IncidentReport table
CREATE TABLE "IncidentReport" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "clientId" TEXT,
    "petId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "mediaUrls" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IncidentReport_orgId_status_idx" ON "IncidentReport"("orgId", "status");
CREATE INDEX "IncidentReport_bookingId_idx" ON "IncidentReport"("bookingId");
CREATE INDEX "IncidentReport_sitterId_idx" ON "IncidentReport"("sitterId");
