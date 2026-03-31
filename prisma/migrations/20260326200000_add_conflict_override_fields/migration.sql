-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "conflictOverrideAt" TIMESTAMP(3),
ADD COLUMN "conflictOverrideBy" TEXT,
ADD COLUMN "conflictOverrideReason" TEXT;
