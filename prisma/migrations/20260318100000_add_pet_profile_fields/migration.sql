-- AlterTable: make bookingId optional and add pet profile fields
ALTER TABLE "Pet" ALTER COLUMN "bookingId" DROP NOT NULL;

-- Add core identity fields
ALTER TABLE "Pet" ADD COLUMN "weight" DOUBLE PRECISION;
ALTER TABLE "Pet" ADD COLUMN "gender" TEXT;
ALTER TABLE "Pet" ADD COLUMN "birthday" TIMESTAMP(3);
ALTER TABLE "Pet" ADD COLUMN "color" TEXT;
ALTER TABLE "Pet" ADD COLUMN "microchipId" TEXT;
ALTER TABLE "Pet" ADD COLUMN "isFixed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Pet" ADD COLUMN "photoUrl" TEXT;

-- Add care instruction fields
ALTER TABLE "Pet" ADD COLUMN "feedingInstructions" TEXT;
ALTER TABLE "Pet" ADD COLUMN "medicationNotes" TEXT;
ALTER TABLE "Pet" ADD COLUMN "behaviorNotes" TEXT;
ALTER TABLE "Pet" ADD COLUMN "houseRules" TEXT;
ALTER TABLE "Pet" ADD COLUMN "walkInstructions" TEXT;

-- Add vet info fields
ALTER TABLE "Pet" ADD COLUMN "vetName" TEXT;
ALTER TABLE "Pet" ADD COLUMN "vetPhone" TEXT;
ALTER TABLE "Pet" ADD COLUMN "vetAddress" TEXT;
ALTER TABLE "Pet" ADD COLUMN "vetClinicName" TEXT;

-- Add status and relationship fields
ALTER TABLE "Pet" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Pet" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Pet" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Pet" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add indexes
CREATE INDEX "Pet_clientId_idx" ON "Pet"("clientId");
CREATE INDEX "Pet_orgId_clientId_idx" ON "Pet"("orgId", "clientId");
