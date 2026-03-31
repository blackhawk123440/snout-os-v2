-- CreateTable: OrgIntegrationConfig
-- Stores per-org integration provider preferences.
-- Each category has a provider selection + a configured flag.
-- Defaults are conservative: no messaging, Stripe for payments, no calendar, no accounting.

CREATE TABLE "OrgIntegrationConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,

    -- Messaging: none = owner's personal phone, twilio = masked numbers, openphone = shared line
    "messagingProvider" TEXT NOT NULL DEFAULT 'none',
    "messagingConfigured" BOOLEAN NOT NULL DEFAULT false,
    "messagingFallbackPhone" TEXT,

    -- Payments: stripe is default, square is future
    "paymentProvider" TEXT NOT NULL DEFAULT 'stripe',
    "paymentConfigured" BOOLEAN NOT NULL DEFAULT false,

    -- Calendar: none = in-app only, google = bidirectional sync
    "calendarProvider" TEXT NOT NULL DEFAULT 'none',
    "calendarConfigured" BOOLEAN NOT NULL DEFAULT false,

    -- Accounting: none = built-in ledger, quickbooks/xero are future
    "accountingProvider" TEXT NOT NULL DEFAULT 'none',
    "accountingConfigured" BOOLEAN NOT NULL DEFAULT false,

    -- Booking Intake: how clients submit bookings
    "bookingIntake" TEXT NOT NULL DEFAULT 'embedded_form',

    -- Extensibility: JSON blob for future provider-specific config
    "providerMeta" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgIntegrationConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgIntegrationConfig_orgId_key" ON "OrgIntegrationConfig"("orgId");
CREATE INDEX "OrgIntegrationConfig_orgId_idx" ON "OrgIntegrationConfig"("orgId");
