-- CreateTable
CREATE TABLE "UserNotificationPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pushMessages" BOOLEAN NOT NULL DEFAULT true,
    "pushVisitStarted" BOOLEAN NOT NULL DEFAULT true,
    "pushReports" BOOLEAN NOT NULL DEFAULT true,
    "pushAssignments" BOOLEAN NOT NULL DEFAULT true,
    "pushCallouts" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationPreferences_userId_key" ON "UserNotificationPreferences"("userId");

-- CreateIndex
CREATE INDEX "UserNotificationPreferences_userId_idx" ON "UserNotificationPreferences"("userId");
