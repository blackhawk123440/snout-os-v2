-- BusinessSettings: cancellation policy
ALTER TABLE "BusinessSettings" ADD COLUMN "cancellationPolicy" TEXT;

-- Client: referral fields
ALTER TABLE "Client" ADD COLUMN "referredBy" TEXT;
ALTER TABLE "Client" ADD COLUMN "referralCode" TEXT;
CREATE UNIQUE INDEX "Client_referralCode_key" ON "Client"("referralCode");
