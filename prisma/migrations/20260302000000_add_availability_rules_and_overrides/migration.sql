-- AlterTable
ALTER TABLE "Sitter" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'America/Chicago';

-- CreateTable
CREATE TABLE "SitterAvailabilityRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "sitterId" TEXT NOT NULL,
    "daysOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterAvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterAvailabilityOverride" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "sitterId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterAvailabilityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SitterAvailabilityRule_orgId_sitterId_idx" ON "SitterAvailabilityRule"("orgId", "sitterId");

-- CreateIndex
CREATE INDEX "SitterAvailabilityRule_sitterId_active_idx" ON "SitterAvailabilityRule"("sitterId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "SitterAvailabilityOverride_orgId_sitterId_date_startTime_endTime_key" ON "SitterAvailabilityOverride"("orgId", "sitterId", "date", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "SitterAvailabilityOverride_orgId_sitterId_date_idx" ON "SitterAvailabilityOverride"("orgId", "sitterId", "date");

-- AddForeignKey
ALTER TABLE "SitterAvailabilityRule" ADD CONSTRAINT "SitterAvailabilityRule_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterAvailabilityOverride" ADD CONSTRAINT "SitterAvailabilityOverride_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
