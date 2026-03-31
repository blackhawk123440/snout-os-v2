-- Add structured report fields
ALTER TABLE "Report" ADD COLUMN "sitterId" TEXT;
ALTER TABLE "Report" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Report" ADD COLUMN "walkDuration" INTEGER;
ALTER TABLE "Report" ADD COLUMN "pottyNotes" TEXT;
ALTER TABLE "Report" ADD COLUMN "foodNotes" TEXT;
ALTER TABLE "Report" ADD COLUMN "waterNotes" TEXT;
ALTER TABLE "Report" ADD COLUMN "medicationNotes" TEXT;
ALTER TABLE "Report" ADD COLUMN "behaviorNotes" TEXT;
ALTER TABLE "Report" ADD COLUMN "personalNote" TEXT;
ALTER TABLE "Report" ADD COLUMN "checkInLat" DOUBLE PRECISION;
ALTER TABLE "Report" ADD COLUMN "checkInLng" DOUBLE PRECISION;
ALTER TABLE "Report" ADD COLUMN "checkOutLat" DOUBLE PRECISION;
ALTER TABLE "Report" ADD COLUMN "checkOutLng" DOUBLE PRECISION;
ALTER TABLE "Report" ADD COLUMN "clientRating" INTEGER;
ALTER TABLE "Report" ADD COLUMN "clientFeedback" TEXT;
ALTER TABLE "Report" ADD COLUMN "ratedAt" TIMESTAMP(3);
ALTER TABLE "Report" ADD COLUMN "sentToClient" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Report" ADD COLUMN "sentAt" TIMESTAMP(3);

-- Add indexes
CREATE INDEX "Report_sitterId_idx" ON "Report"("sitterId");
CREATE INDEX "Report_clientId_idx" ON "Report"("clientId");
CREATE INDEX "Report_orgId_clientId_createdAt_idx" ON "Report"("orgId", "clientId", "createdAt" DESC);
