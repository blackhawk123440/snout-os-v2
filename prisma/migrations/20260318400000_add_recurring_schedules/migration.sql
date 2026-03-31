-- Add recurringScheduleId to Booking
ALTER TABLE "Booking" ADD COLUMN "recurringScheduleId" TEXT;
CREATE INDEX "Booking_recurringScheduleId_idx" ON "Booking"("recurringScheduleId");

-- Create RecurringSchedule table
CREATE TABLE "RecurringSchedule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sitterId" TEXT,
    "service" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "daysOfWeek" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "duration" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "address" TEXT,
    "notes" TEXT,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "afterHours" BOOLEAN NOT NULL DEFAULT false,
    "holiday" BOOLEAN NOT NULL DEFAULT false,
    "petIds" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastGeneratedAt" TIMESTAMP(3),
    "invoicingMode" TEXT NOT NULL DEFAULT 'per_visit',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecurringSchedule_orgId_status_idx" ON "RecurringSchedule"("orgId", "status");
CREATE INDEX "RecurringSchedule_orgId_clientId_idx" ON "RecurringSchedule"("orgId", "clientId");
CREATE INDEX "RecurringSchedule_sitterId_idx" ON "RecurringSchedule"("sitterId");
