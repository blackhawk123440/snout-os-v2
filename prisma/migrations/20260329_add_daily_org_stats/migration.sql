-- CreateTable
CREATE TABLE "DailyOrgStats" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "bookingsCreated" INTEGER NOT NULL DEFAULT 0,
    "bookingsConfirmed" INTEGER NOT NULL DEFAULT 0,
    "bookingsCompleted" INTEGER NOT NULL DEFAULT 0,
    "revenueTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newClients" INTEGER NOT NULL DEFAULT 0,
    "notificationsSent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyOrgStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyOrgStats_orgId_date_key" ON "DailyOrgStats"("orgId", "date");

-- CreateIndex
CREATE INDEX "DailyOrgStats_orgId_date_idx" ON "DailyOrgStats"("orgId", "date");
