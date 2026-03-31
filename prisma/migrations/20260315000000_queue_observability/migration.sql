-- CreateEnum
CREATE TYPE "QueueJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD_LETTERED');

-- CreateTable
CREATE TABLE "QueueJobRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "queueName" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "QueueJobStatus" NOT NULL DEFAULT 'QUEUED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerErrorCode" TEXT,
    "subsystem" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "correlationId" TEXT,
    "payloadJson" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "retryOfJobId" TEXT,
    "lastRetryAt" TIMESTAMP(3),
    "lastRetryBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueJobRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QueueJobRecord_queueName_jobId_key" ON "QueueJobRecord"("queueName", "jobId");

-- CreateIndex
CREATE INDEX "QueueJobRecord_orgId_idx" ON "QueueJobRecord"("orgId");

-- CreateIndex
CREATE INDEX "QueueJobRecord_status_idx" ON "QueueJobRecord"("status");

-- CreateIndex
CREATE INDEX "QueueJobRecord_subsystem_idx" ON "QueueJobRecord"("subsystem");

-- CreateIndex
CREATE INDEX "QueueJobRecord_resourceType_resourceId_idx" ON "QueueJobRecord"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "QueueJobRecord_correlationId_idx" ON "QueueJobRecord"("correlationId");

-- CreateIndex
CREATE INDEX "QueueJobRecord_createdAt_idx" ON "QueueJobRecord"("createdAt");

-- CreateIndex
CREATE INDEX "QueueJobRecord_updatedAt_idx" ON "QueueJobRecord"("updatedAt");

-- CreateIndex
CREATE INDEX "QueueJobRecord_retryOfJobId_idx" ON "QueueJobRecord"("retryOfJobId");
