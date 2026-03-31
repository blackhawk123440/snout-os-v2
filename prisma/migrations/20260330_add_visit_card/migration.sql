-- CreateTable
CREATE TABLE "VisitCard" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL,
    "checkOutAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "checkInLat" DOUBLE PRECISION,
    "checkInLng" DOUBLE PRECISION,
    "checkOutLat" DOUBLE PRECISION,
    "checkOutLng" DOUBLE PRECISION,
    "photoUrls" TEXT,
    "petChecklists" TEXT,
    "sitterNote" TEXT,
    "assembledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentToClient" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "VisitCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitCard_bookingId_key" ON "VisitCard"("bookingId");

-- CreateIndex
CREATE INDEX "VisitCard_orgId_clientId_idx" ON "VisitCard"("orgId", "clientId");

-- CreateIndex
CREATE INDEX "VisitCard_bookingId_idx" ON "VisitCard"("bookingId");
