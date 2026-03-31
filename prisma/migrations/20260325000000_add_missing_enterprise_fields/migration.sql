-- Booking: payment and cancellation fields
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "stripeCheckoutSessionId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "depositAmount" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "balanceDueDate" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paymentDeadline" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;

-- RecurringSchedule: payment tracking fields
ALTER TABLE "RecurringSchedule" ADD COLUMN IF NOT EXISTS "lastPaymentDate" TIMESTAMP(3);
ALTER TABLE "RecurringSchedule" ADD COLUMN IF NOT EXISTS "lastPaymentAmount" DOUBLE PRECISION;
ALTER TABLE "RecurringSchedule" ADD COLUMN IF NOT EXISTS "paymentFailureCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "RecurringSchedule_orgId_clientId_status_idx" ON "RecurringSchedule"("orgId", "clientId", "status");

-- Client: payment method
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "defaultPaymentMethodId" TEXT;

-- BusinessSettings: ops policy fields
ALTER TABLE "BusinessSettings" ADD COLUMN IF NOT EXISTS "sitterPolicies" TEXT;
ALTER TABLE "BusinessSettings" ADD COLUMN IF NOT EXISTS "paymentHoldHours" INTEGER NOT NULL DEFAULT 2;

-- User: invite and welcome token fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "welcomeToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "welcomeTokenExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "User_inviteToken_key" ON "User"("inviteToken");
CREATE UNIQUE INDEX IF NOT EXISTS "User_welcomeToken_key" ON "User"("welcomeToken");
