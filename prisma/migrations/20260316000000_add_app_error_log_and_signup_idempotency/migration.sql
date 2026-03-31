-- CreateTable
CREATE TABLE "AppErrorLog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignupIdempotency" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "orgId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignupIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppErrorLog_code_idx" ON "AppErrorLog"("code");

-- CreateIndex
CREATE INDEX "AppErrorLog_createdAt_idx" ON "AppErrorLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SignupIdempotency_email_key" ON "SignupIdempotency"("email");

-- CreateIndex
CREATE INDEX "SignupIdempotency_email_idx" ON "SignupIdempotency"("email");

-- CreateIndex
CREATE INDEX "SignupIdempotency_createdAt_idx" ON "SignupIdempotency"("createdAt");
