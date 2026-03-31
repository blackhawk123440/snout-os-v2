-- AlterTable: Add mileage fields to Booking
ALTER TABLE "Booking" ADD COLUMN "estimatedMileage" DOUBLE PRECISION;
ALTER TABLE "Booking" ADD COLUMN "actualMileage" DOUBLE PRECISION;

-- CreateTable: SitterMileageLog
CREATE TABLE "SitterMileageLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "estimatedMi" DOUBLE PRECISION NOT NULL,
    "actualMi" DOUBLE PRECISION,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitterMileageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SitterMileageLog_bookingId_key" ON "SitterMileageLog"("bookingId");

-- CreateIndex
CREATE INDEX "SitterMileageLog_orgId_sitterId_month_idx" ON "SitterMileageLog"("orgId", "sitterId", "month");

-- AddForeignKey
ALTER TABLE "SitterMileageLog" ADD CONSTRAINT "SitterMileageLog_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
