-- AlterTable: Add travel buffer to BusinessSettings
ALTER TABLE "BusinessSettings" ADD COLUMN "travelBufferMinutes" INTEGER NOT NULL DEFAULT 20;

-- CreateTable: SitterQuietHours
CREATE TABLE "SitterQuietHours" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterQuietHours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SitterQuietHours_sitterId_key" ON "SitterQuietHours"("sitterId");

-- CreateIndex
CREATE INDEX "SitterQuietHours_orgId_sitterId_idx" ON "SitterQuietHours"("orgId", "sitterId");

-- AddForeignKey
ALTER TABLE "SitterQuietHours" ADD CONSTRAINT "SitterQuietHours_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
