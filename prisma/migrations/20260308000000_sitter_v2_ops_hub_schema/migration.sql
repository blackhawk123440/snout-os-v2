-- Sitter V2 ops hub schema additions

ALTER TABLE "Booking"
  ADD COLUMN "entryInstructions" TEXT,
  ADD COLUMN "doorCode" TEXT;

CREATE TABLE "ClientEmergencyContact" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relationship" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientEmergencyContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientEmergencyContact_orgId_idx" ON "ClientEmergencyContact"("orgId");
CREATE INDEX "ClientEmergencyContact_clientId_idx" ON "ClientEmergencyContact"("clientId");
CREATE INDEX "ClientEmergencyContact_orgId_clientId_idx" ON "ClientEmergencyContact"("orgId", "clientId");

ALTER TABLE "ClientEmergencyContact"
  ADD CONSTRAINT "ClientEmergencyContact_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookingChecklistItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookingChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingChecklistItem_bookingId_type_key" ON "BookingChecklistItem"("bookingId", "type");
CREATE INDEX "BookingChecklistItem_orgId_idx" ON "BookingChecklistItem"("orgId");
CREATE INDEX "BookingChecklistItem_bookingId_idx" ON "BookingChecklistItem"("bookingId");
CREATE INDEX "BookingChecklistItem_orgId_bookingId_idx" ON "BookingChecklistItem"("orgId", "bookingId");

ALTER TABLE "BookingChecklistItem"
  ADD CONSTRAINT "BookingChecklistItem_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
