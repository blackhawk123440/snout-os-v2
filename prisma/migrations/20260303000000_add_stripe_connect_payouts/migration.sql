-- CreateTable
CREATE TABLE "SitterStripeAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "sitterId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "onboardingStatus" TEXT NOT NULL DEFAULT 'pending',
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterStripeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutTransfer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "sitterId" TEXT NOT NULL,
    "bookingId" TEXT,
    "stripeTransferId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterEarning" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "sitterId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amountGross" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tips" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitterEarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SitterStripeAccount_sitterId_key" ON "SitterStripeAccount"("sitterId");

-- CreateIndex
CREATE INDEX "SitterStripeAccount_orgId_idx" ON "SitterStripeAccount"("orgId");

-- CreateIndex
CREATE INDEX "SitterStripeAccount_accountId_idx" ON "SitterStripeAccount"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "SitterEarning_orgId_sitterId_bookingId_key" ON "SitterEarning"("orgId", "sitterId", "bookingId");

-- CreateIndex
CREATE INDEX "PayoutTransfer_orgId_idx" ON "PayoutTransfer"("orgId");

-- CreateIndex
CREATE INDEX "PayoutTransfer_sitterId_idx" ON "PayoutTransfer"("sitterId");

-- CreateIndex
CREATE INDEX "PayoutTransfer_bookingId_idx" ON "PayoutTransfer"("bookingId");

-- CreateIndex
CREATE INDEX "PayoutTransfer_status_idx" ON "PayoutTransfer"("status");

-- CreateIndex
CREATE INDEX "PayoutTransfer_createdAt_idx" ON "PayoutTransfer"("createdAt");

-- CreateIndex
CREATE INDEX "SitterEarning_orgId_idx" ON "SitterEarning"("orgId");

-- CreateIndex
CREATE INDEX "SitterEarning_sitterId_idx" ON "SitterEarning"("sitterId");

-- CreateIndex
CREATE INDEX "SitterEarning_bookingId_idx" ON "SitterEarning"("bookingId");

-- AddForeignKey
ALTER TABLE "SitterStripeAccount" ADD CONSTRAINT "SitterStripeAccount_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutTransfer" ADD CONSTRAINT "PayoutTransfer_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterEarning" ADD CONSTRAINT "SitterEarning_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
