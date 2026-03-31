-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'personal',
    "brandingJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rate" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "baseRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "pickupAddress" TEXT,
    "dropoffAddress" TEXT,
    "service" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "pricingSnapshot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assignmentType" TEXT,
    "dispatchStatus" TEXT NOT NULL DEFAULT 'auto',
    "manualDispatchReason" TEXT,
    "manualDispatchAt" TIMESTAMP(3),
    "notes" TEXT,
    "stripePaymentLinkUrl" TEXT,
    "tipLinkUrl" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "afterHours" BOOLEAN NOT NULL DEFAULT false,
    "holiday" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sitterId" TEXT,
    "clientId" TEXT,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "breed" TEXT,
    "age" INTEGER,
    "notes" TEXT,
    "bookingId" TEXT NOT NULL,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSlot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "bookingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sitter" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "commissionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 80.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "personalPhone" TEXT,
    "openphonePhone" TEXT,
    "phoneType" TEXT,
    "stripeAccountId" TEXT,
    "currentTierId" TEXT,
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "googleTokenExpiry" TIMESTAMP(3),
    "googleCalendarId" TEXT DEFAULT 'primary',
    "calendarSyncEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Sitter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterPoolOffer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "bookingId" TEXT NOT NULL,
    "sitterId" TEXT,
    "sitterIds" TEXT,
    "message" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "responses" TEXT NOT NULL DEFAULT '[]',
    "acceptedSitterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterPoolOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSitterPool" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "bookingId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "BookingSitterPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "from" TEXT NOT NULL DEFAULT '',
    "to" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "bookingId" TEXT,
    "content" TEXT NOT NULL,
    "mediaUrls" TEXT,
    "visitStarted" TIMESTAMP(3),
    "visitCompleted" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "calendarId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationTrigger" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerConfig" TEXT NOT NULL,

    CONSTRAINT "AutomationTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationConditionGroup" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "operator" TEXT NOT NULL DEFAULT 'all',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AutomationConditionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationCondition" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "conditionType" TEXT NOT NULL,
    "conditionConfig" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AutomationCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationAction" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionConfig" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AutomationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationTemplate" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variablesUsed" TEXT,
    "previewText" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AutomationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "automationId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reason" TEXT,
    "targetEntityType" TEXT,
    "targetEntityId" TEXT,
    "idempotencyKey" TEXT,
    "metadata" TEXT,
    "correlationId" TEXT,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRunStep" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "automationRunId" TEXT NOT NULL,
    "stepType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" TEXT,
    "output" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "visibleToOwner" BOOLEAN NOT NULL DEFAULT true,
    "visibleToSitter" BOOLEAN NOT NULL DEFAULT false,
    "visibleToClient" BOOLEAN NOT NULL DEFAULT false,
    "editableBySitter" BOOLEAN NOT NULL DEFAULT false,
    "editableByClient" BOOLEAN NOT NULL DEFAULT false,
    "showInTemplates" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT,
    "defaultValue" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "customFieldId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "petId" TEXT,
    "sitterId" TEXT,
    "clientId" TEXT,
    "bookingId" TEXT,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceConfig" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION,
    "defaultDuration" INTEGER,
    "category" TEXT,
    "minBookingNotice" INTEGER,
    "gpsCheckInRequired" BOOLEAN NOT NULL DEFAULT false,
    "photosRequired" BOOLEAN NOT NULL DEFAULT false,
    "allowedSitterTiers" TEXT,
    "allowedSitterTypes" TEXT,
    "weekendMultiplier" DOUBLE PRECISION DEFAULT 1.0,
    "holidayMultiplier" DOUBLE PRECISION DEFAULT 1.0,
    "timeOfDayRules" TEXT,
    "holidayBehavior" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "calculation" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "valueType" TEXT NOT NULL,
    "minBookingTotal" DOUBLE PRECISION,
    "maxDiscount" DOUBLE PRECISION,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "conditions" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountUsage" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "discountId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "serviceType" TEXT,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "options" TEXT,
    "placeholder" TEXT,
    "helpText" TEXT,
    "visibleToSitter" BOOLEAN NOT NULL DEFAULT false,
    "visibleToClient" BOOLEAN NOT NULL DEFAULT true,
    "includeInReport" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateHistory" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterTier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pointTarget" INTEGER NOT NULL,
    "minCompletionRate" DOUBLE PRECISION,
    "minResponseRate" DOUBLE PRECISION,
    "benefits" TEXT,
    "priorityLevel" INTEGER NOT NULL DEFAULT 0,
    "canTakeHouseSits" BOOLEAN NOT NULL DEFAULT false,
    "canTakeTwentyFourHourCare" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "canJoinPools" BOOLEAN NOT NULL DEFAULT false,
    "canAutoAssign" BOOLEAN NOT NULL DEFAULT false,
    "canOvernight" BOOLEAN NOT NULL DEFAULT false,
    "canSameDay" BOOLEAN NOT NULL DEFAULT false,
    "canHighValue" BOOLEAN NOT NULL DEFAULT false,
    "canRecurring" BOOLEAN NOT NULL DEFAULT false,
    "canLeadPool" BOOLEAN NOT NULL DEFAULT false,
    "canOverrideDecline" BOOLEAN NOT NULL DEFAULT false,
    "commissionSplit" DOUBLE PRECISION NOT NULL DEFAULT 70.0,
    "badgeColor" TEXT,
    "badgeStyle" TEXT,
    "description" TEXT,
    "progressionRequirements" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterTierHistory" (
    "id" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "completionRate" DOUBLE PRECISION,
    "responseRate" DOUBLE PRECISION,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3),
    "changedBy" TEXT,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitterTierHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePointWeight" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "duration" INTEGER,
    "points" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePointWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT,
    "address" TEXT,
    "tags" TEXT,
    "lifetimeValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastBookingAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingTagAssignment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "bookingId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingTagAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPipeline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "transitions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingPipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessPhone" TEXT,
    "businessEmail" TEXT,
    "businessAddress" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'America/New_York',
    "operatingHours" TEXT,
    "holidays" TEXT,
    "taxSettings" TEXT,
    "contentBlocks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "role" TEXT NOT NULL DEFAULT 'owner',
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sitterId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "BaselineSnapshot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "bookingId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookingFormTotal" DOUBLE PRECISION,
    "calendarViewTotal" DOUBLE PRECISION,
    "sitterDashboardTotal" DOUBLE PRECISION,
    "ownerDashboardTotal" DOUBLE PRECISION,
    "stripePaymentTotal" DOUBLE PRECISION,
    "storedTotalPrice" DOUBLE PRECISION,
    "calculatedBreakdown" TEXT,
    "notes" TEXT,

    CONSTRAINT "BaselineSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "eventType" TEXT NOT NULL,
    "automationType" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "metadata" TEXT,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingStatusHistory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "bookingId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeCharge" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "amount" INTEGER NOT NULL,
    "amountRefunded" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "description" TEXT,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "paymentMethod" TEXT,
    "paymentIntentId" TEXT,
    "invoiceId" TEXT,
    "bookingId" TEXT,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeRefund" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "reason" TEXT,
    "status" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripePayout" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "arrivalDate" TIMESTAMP(3),
    "description" TEXT,
    "statementDescriptor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripePayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeBalanceTransaction" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "type" TEXT NOT NULL,
    "description" TEXT,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "net" INTEGER NOT NULL,
    "chargeId" TEXT,
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeBalanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "payPeriodStart" TIMESTAMP(3) NOT NULL,
    "payPeriodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "totalSitters" INTEGER NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLineItem" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "bookingCount" INTEGER NOT NULL,
    "totalEarnings" DOUBLE PRECISION NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "adjustments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerConfigJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageNumber" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "provider" TEXT NOT NULL DEFAULT 'twilio',
    "providerNumberSid" TEXT NOT NULL DEFAULT '',
    "e164" TEXT NOT NULL DEFAULT '',
    "market" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "numberClass" TEXT NOT NULL DEFAULT 'pool',
    "assignedSitterId" TEXT,
    "ownerId" TEXT,
    "isRotating" BOOLEAN NOT NULL DEFAULT false,
    "rotationPriority" INTEGER,
    "lastAssignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCredential" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "providerType" TEXT NOT NULL DEFAULT 'twilio',
    "encryptedConfig" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageThread" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "bookingId" TEXT,
    "clientId" TEXT,
    "assignedSitterId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "providerSessionSid" TEXT,
    "maskedNumberE164" TEXT,
    "numberClass" TEXT,
    "messageNumberId" TEXT,
    "isOneTimeClient" BOOLEAN NOT NULL DEFAULT false,
    "isMeetAndGreet" BOOLEAN NOT NULL DEFAULT false,
    "meetAndGreetApprovedAt" TIMESTAMP(3),
    "assignmentWindowId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "ownerUnreadCount" INTEGER NOT NULL DEFAULT 0,
    "threadType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageParticipant" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT,
    "displayName" TEXT NOT NULL,
    "realE164" TEXT NOT NULL,
    "providerParticipantSid" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageEvent" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorClientId" TEXT,
    "providerMessageSid" TEXT,
    "body" TEXT NOT NULL,
    "mediaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'queued',
    "failureCode" TEXT,
    "failureDetail" TEXT,
    "requiresResponse" BOOLEAN NOT NULL DEFAULT false,
    "responseToMessageId" TEXT,
    "responseSlaSeconds" INTEGER,
    "responsibleSitterIdSnapshot" TEXT,
    "promptId" TEXT,
    "metadataJson" TEXT,
    "correlationIds" TEXT,
    "answeredAt" TIMESTAMP(3),
    "attemptCount" INTEGER,
    "lastAttemptAt" TIMESTAMP(3),
    "providerErrorCode" TEXT,
    "providerErrorMessage" TEXT,

    CONSTRAINT "MessageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreadAssignmentAudit" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "fromSitterId" TEXT,
    "toSitterId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreadAssignmentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptOutState" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT,
    "phoneE164" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptOutState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "bookingId" TEXT,
    "inboundMessageEventId" TEXT NOT NULL,
    "responsibleSitterId" TEXT,
    "slaSeconds" INTEGER,
    "inboundAt" TIMESTAMP(3) NOT NULL,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'pending',
    "resolvedAt" TIMESTAMP(3),
    "resolvedByMessageEventId" TEXT,
    "responseSeconds" INTEGER,
    "escalationReason" TEXT,
    "ignoreReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterMaskedNumber" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "messageNumberId" TEXT NOT NULL,
    "providerParticipantSid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterMaskedNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentWindow" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AntiPoachingAttempt" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "violationType" TEXT NOT NULL,
    "detectedContent" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'blocked',
    "ownerNotifiedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AntiPoachingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterTierSnapshot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "rolling30dScore" DOUBLE PRECISION NOT NULL,
    "rolling30dBreakdownJson" TEXT NOT NULL,
    "rolling26wScore" DOUBLE PRECISION,
    "rolling26wBreakdownJson" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'foundation',
    "provisional" BOOLEAN NOT NULL DEFAULT false,
    "visits30d" INTEGER NOT NULL DEFAULT 0,
    "offers30d" INTEGER NOT NULL DEFAULT 0,
    "lastPromotionAt" TIMESTAMP(3),
    "lastDemotionAt" TIMESTAMP(3),
    "atRisk" BOOLEAN NOT NULL DEFAULT false,
    "atRiskReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterTierSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterServiceEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "notes" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterServiceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterTimeOff" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "approvedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "threadId" TEXT,
    "bookingId" TEXT,
    "offeredAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'dashboard',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "withinAvailability" BOOLEAN NOT NULL DEFAULT true,
    "leadTimeValid" BOOLEAN NOT NULL DEFAULT true,
    "routingValid" BOOLEAN NOT NULL DEFAULT true,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "excludedReason" TEXT,
    "correlationIds" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "clientId" TEXT,
    "bookingId" TEXT NOT NULL,
    "threadId" TEXT,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "lateMinutes" INTEGER DEFAULT 0,
    "checklistMissedCount" INTEGER NOT NULL DEFAULT 0,
    "mediaMissingCount" INTEGER NOT NULL DEFAULT 0,
    "complaintVerified" BOOLEAN NOT NULL DEFAULT false,
    "safetyFlag" BOOLEAN NOT NULL DEFAULT false,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "excludedReason" TEXT,
    "correlationIds" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterCompensation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "basePay" DOUBLE PRECISION NOT NULL DEFAULT 12.50,
    "lastRaiseAt" TIMESTAMP(3),
    "lastRaiseAmount" DOUBLE PRECISION,
    "nextReviewDate" TIMESTAMP(3),
    "perkFlags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterCompensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterMetricsWindow" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "windowType" TEXT NOT NULL,
    "avgResponseSeconds" DOUBLE PRECISION,
    "medianResponseSeconds" DOUBLE PRECISION,
    "responseRate" DOUBLE PRECISION,
    "offerAcceptRate" DOUBLE PRECISION,
    "offerDeclineRate" DOUBLE PRECISION,
    "offerExpireRate" DOUBLE PRECISION,
    "lastOfferRespondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterMetricsWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageResponseLink" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "requiresResponseEventId" TEXT NOT NULL,
    "responseEventId" TEXT NOT NULL,
    "responseMinutes" INTEGER NOT NULL,
    "responseSeconds" INTEGER,
    "withinAssignmentWindow" BOOLEAN NOT NULL DEFAULT false,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "excludedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageResponseLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingCalendarEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default',
    "bookingId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "googleCalendarEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyReward" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "lastEarned" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "LoyaltyReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetHealthLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "sitterId" TEXT,
    "bookingId" TEXT,
    "note" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetHealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterVerification" (
    "id" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "backgroundCheck" TIMESTAMP(3),
    "insuranceProof" TEXT,
    "reviewedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "SitterVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsInsight" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period" TEXT NOT NULL,

    CONSTRAINT "AnalyticsInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rate_service_duration_key" ON "Rate"("service", "duration");

-- CreateIndex
CREATE INDEX "Booking_sitterId_idx" ON "Booking"("sitterId");

-- CreateIndex
CREATE INDEX "Booking_orgId_idx" ON "Booking"("orgId");

-- CreateIndex
CREATE INDEX "Booking_orgId_startAt_idx" ON "Booking"("orgId", "startAt");

-- CreateIndex
CREATE INDEX "Booking_orgId_sitterId_idx" ON "Booking"("orgId", "sitterId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");

-- CreateIndex
CREATE INDEX "Booking_clientId_idx" ON "Booking"("clientId");

-- CreateIndex
CREATE INDEX "Pet_bookingId_idx" ON "Pet"("bookingId");

-- CreateIndex
CREATE INDEX "Pet_orgId_idx" ON "Pet"("orgId");

-- CreateIndex
CREATE INDEX "TimeSlot_bookingId_idx" ON "TimeSlot"("bookingId");

-- CreateIndex
CREATE INDEX "TimeSlot_orgId_idx" ON "TimeSlot"("orgId");

-- CreateIndex
CREATE INDEX "Sitter_active_idx" ON "Sitter"("active");

-- CreateIndex
CREATE INDEX "Sitter_orgId_idx" ON "Sitter"("orgId");

-- CreateIndex
CREATE INDEX "Sitter_currentTierId_idx" ON "Sitter"("currentTierId");

-- CreateIndex
CREATE INDEX "SitterPoolOffer_bookingId_idx" ON "SitterPoolOffer"("bookingId");

-- CreateIndex
CREATE INDEX "SitterPoolOffer_orgId_idx" ON "SitterPoolOffer"("orgId");

-- CreateIndex
CREATE INDEX "SitterPoolOffer_sitterId_idx" ON "SitterPoolOffer"("sitterId");

-- CreateIndex
CREATE INDEX "SitterPoolOffer_status_idx" ON "SitterPoolOffer"("status");

-- CreateIndex
CREATE INDEX "BookingSitterPool_orgId_idx" ON "BookingSitterPool"("orgId");

-- CreateIndex
CREATE INDEX "BookingSitterPool_bookingId_idx" ON "BookingSitterPool"("bookingId");

-- CreateIndex
CREATE INDEX "BookingSitterPool_sitterId_idx" ON "BookingSitterPool"("sitterId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSitterPool_bookingId_sitterId_key" ON "BookingSitterPool"("bookingId", "sitterId");

-- CreateIndex
CREATE INDEX "Message_bookingId_idx" ON "Message"("bookingId");

-- CreateIndex
CREATE INDEX "Message_orgId_idx" ON "Message"("orgId");

-- CreateIndex
CREATE INDEX "Message_direction_idx" ON "Message"("direction");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE INDEX "Setting_category_idx" ON "Setting"("category");

-- CreateIndex
CREATE INDEX "Report_bookingId_idx" ON "Report"("bookingId");

-- CreateIndex
CREATE INDEX "Report_orgId_idx" ON "Report"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarAccount_email_key" ON "GoogleCalendarAccount"("email");

-- CreateIndex
CREATE INDEX "GoogleCalendarAccount_email_idx" ON "GoogleCalendarAccount"("email");

-- CreateIndex
CREATE INDEX "Automation_isEnabled_idx" ON "Automation"("isEnabled");

-- CreateIndex
CREATE INDEX "Automation_orgId_idx" ON "Automation"("orgId");

-- CreateIndex
CREATE INDEX "Automation_status_idx" ON "Automation"("status");

-- CreateIndex
CREATE INDEX "Automation_scope_idx" ON "Automation"("scope");

-- CreateIndex
CREATE INDEX "Automation_createdAt_idx" ON "Automation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationTrigger_automationId_key" ON "AutomationTrigger"("automationId");

-- CreateIndex
CREATE INDEX "AutomationTrigger_triggerType_idx" ON "AutomationTrigger"("triggerType");

-- CreateIndex
CREATE INDEX "AutomationConditionGroup_automationId_idx" ON "AutomationConditionGroup"("automationId");

-- CreateIndex
CREATE INDEX "AutomationConditionGroup_order_idx" ON "AutomationConditionGroup"("order");

-- CreateIndex
CREATE INDEX "AutomationCondition_groupId_idx" ON "AutomationCondition"("groupId");

-- CreateIndex
CREATE INDEX "AutomationCondition_order_idx" ON "AutomationCondition"("order");

-- CreateIndex
CREATE INDEX "AutomationAction_automationId_idx" ON "AutomationAction"("automationId");

-- CreateIndex
CREATE INDEX "AutomationAction_order_idx" ON "AutomationAction"("order");

-- CreateIndex
CREATE INDEX "AutomationTemplate_automationId_idx" ON "AutomationTemplate"("automationId");

-- CreateIndex
CREATE INDEX "AutomationTemplate_templateType_idx" ON "AutomationTemplate"("templateType");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRun_idempotencyKey_key" ON "AutomationRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AutomationRun_automationId_idx" ON "AutomationRun"("automationId");

-- CreateIndex
CREATE INDEX "AutomationRun_orgId_idx" ON "AutomationRun"("orgId");

-- CreateIndex
CREATE INDEX "AutomationRun_status_idx" ON "AutomationRun"("status");

-- CreateIndex
CREATE INDEX "AutomationRun_triggeredAt_idx" ON "AutomationRun"("triggeredAt");

-- CreateIndex
CREATE INDEX "AutomationRun_targetEntityType_targetEntityId_idx" ON "AutomationRun"("targetEntityType", "targetEntityId");

-- CreateIndex
CREATE INDEX "AutomationRun_correlationId_idx" ON "AutomationRun"("correlationId");

-- CreateIndex
CREATE INDEX "AutomationRun_idempotencyKey_idx" ON "AutomationRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AutomationRunStep_automationRunId_idx" ON "AutomationRunStep"("automationRunId");

-- CreateIndex
CREATE INDEX "AutomationRunStep_orgId_idx" ON "AutomationRunStep"("orgId");

-- CreateIndex
CREATE INDEX "AutomationRunStep_stepType_idx" ON "AutomationRunStep"("stepType");

-- CreateIndex
CREATE INDEX "AutomationRunStep_status_idx" ON "AutomationRunStep"("status");

-- CreateIndex
CREATE INDEX "CustomField_entityType_idx" ON "CustomField"("entityType");

-- CreateIndex
CREATE INDEX "CustomFieldValue_orgId_idx" ON "CustomFieldValue"("orgId");

-- CreateIndex
CREATE INDEX "CustomFieldValue_entityId_idx" ON "CustomFieldValue"("entityId");

-- CreateIndex
CREATE INDEX "CustomFieldValue_petId_idx" ON "CustomFieldValue"("petId");

-- CreateIndex
CREATE INDEX "CustomFieldValue_sitterId_idx" ON "CustomFieldValue"("sitterId");

-- CreateIndex
CREATE INDEX "CustomFieldValue_clientId_idx" ON "CustomFieldValue"("clientId");

-- CreateIndex
CREATE INDEX "CustomFieldValue_bookingId_idx" ON "CustomFieldValue"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldValue_customFieldId_entityId_key" ON "CustomFieldValue"("customFieldId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceConfig_serviceName_key" ON "ServiceConfig"("serviceName");

-- CreateIndex
CREATE INDEX "ServiceConfig_serviceName_idx" ON "ServiceConfig"("serviceName");

-- CreateIndex
CREATE INDEX "ServiceConfig_category_idx" ON "ServiceConfig"("category");

-- CreateIndex
CREATE INDEX "PricingRule_enabled_idx" ON "PricingRule"("enabled");

-- CreateIndex
CREATE INDEX "PricingRule_type_idx" ON "PricingRule"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_code_key" ON "Discount"("code");

-- CreateIndex
CREATE INDEX "Discount_code_idx" ON "Discount"("code");

-- CreateIndex
CREATE INDEX "Discount_type_idx" ON "Discount"("type");

-- CreateIndex
CREATE INDEX "Discount_enabled_idx" ON "Discount"("enabled");

-- CreateIndex
CREATE INDEX "DiscountUsage_orgId_idx" ON "DiscountUsage"("orgId");

-- CreateIndex
CREATE INDEX "DiscountUsage_discountId_idx" ON "DiscountUsage"("discountId");

-- CreateIndex
CREATE INDEX "DiscountUsage_bookingId_idx" ON "DiscountUsage"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountUsage_bookingId_key" ON "DiscountUsage"("bookingId");

-- CreateIndex
CREATE INDEX "FormField_serviceType_idx" ON "FormField"("serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_templateKey_key" ON "MessageTemplate"("templateKey");

-- CreateIndex
CREATE INDEX "MessageTemplate_category_idx" ON "MessageTemplate"("category");

-- CreateIndex
CREATE INDEX "MessageTemplate_type_idx" ON "MessageTemplate"("type");

-- CreateIndex
CREATE INDEX "MessageTemplate_templateKey_idx" ON "MessageTemplate"("templateKey");

-- CreateIndex
CREATE INDEX "TemplateHistory_templateId_idx" ON "TemplateHistory"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_resource_action_key" ON "RolePermission"("roleId", "resource", "action");

-- CreateIndex
CREATE INDEX "UserRole_userId_userType_idx" ON "UserRole"("userId", "userType");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_userType_roleId_key" ON "UserRole"("userId", "userType", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "SitterTier_name_key" ON "SitterTier"("name");

-- CreateIndex
CREATE INDEX "SitterTier_priorityLevel_idx" ON "SitterTier"("priorityLevel");

-- CreateIndex
CREATE INDEX "SitterTierHistory_sitterId_idx" ON "SitterTierHistory"("sitterId");

-- CreateIndex
CREATE INDEX "SitterTierHistory_tierId_idx" ON "SitterTierHistory"("tierId");

-- CreateIndex
CREATE INDEX "SitterTierHistory_periodStart_idx" ON "SitterTierHistory"("periodStart");

-- CreateIndex
CREATE INDEX "SitterTierHistory_createdAt_idx" ON "SitterTierHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ServicePointWeight_service_idx" ON "ServicePointWeight"("service");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePointWeight_service_duration_key" ON "ServicePointWeight"("service", "duration");

-- CreateIndex
CREATE INDEX "Client_phone_idx" ON "Client"("phone");

-- CreateIndex
CREATE INDEX "Client_email_idx" ON "Client"("email");

-- CreateIndex
CREATE INDEX "Client_orgId_idx" ON "Client"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_orgId_phone_key" ON "Client"("orgId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Client_phone_key" ON "Client"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "BookingTag_name_key" ON "BookingTag"("name");

-- CreateIndex
CREATE INDEX "BookingTagAssignment_orgId_idx" ON "BookingTagAssignment"("orgId");

-- CreateIndex
CREATE INDEX "BookingTagAssignment_bookingId_idx" ON "BookingTagAssignment"("bookingId");

-- CreateIndex
CREATE INDEX "BookingTagAssignment_tagId_idx" ON "BookingTagAssignment"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingTagAssignment_bookingId_tagId_key" ON "BookingTagAssignment"("bookingId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPipeline_name_key" ON "BookingPipeline"("name");

-- CreateIndex
CREATE INDEX "BookingPipeline_order_idx" ON "BookingPipeline"("order");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_sitterId_key" ON "User"("sitterId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_orgId_idx" ON "User"("orgId");

-- CreateIndex
CREATE INDEX "User_sitterId_idx" ON "User"("sitterId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_sessionToken_idx" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "BaselineSnapshot_orgId_idx" ON "BaselineSnapshot"("orgId");

-- CreateIndex
CREATE INDEX "BaselineSnapshot_bookingId_idx" ON "BaselineSnapshot"("bookingId");

-- CreateIndex
CREATE INDEX "BaselineSnapshot_timestamp_idx" ON "BaselineSnapshot"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_key_idx" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_enabled_idx" ON "FeatureFlag"("enabled");

-- CreateIndex
CREATE INDEX "EventLog_orgId_idx" ON "EventLog"("orgId");

-- CreateIndex
CREATE INDEX "EventLog_eventType_idx" ON "EventLog"("eventType");

-- CreateIndex
CREATE INDEX "EventLog_automationType_idx" ON "EventLog"("automationType");

-- CreateIndex
CREATE INDEX "EventLog_status_idx" ON "EventLog"("status");

-- CreateIndex
CREATE INDEX "EventLog_bookingId_idx" ON "EventLog"("bookingId");

-- CreateIndex
CREATE INDEX "EventLog_createdAt_idx" ON "EventLog"("createdAt");

-- CreateIndex
CREATE INDEX "BookingStatusHistory_orgId_idx" ON "BookingStatusHistory"("orgId");

-- CreateIndex
CREATE INDEX "BookingStatusHistory_bookingId_idx" ON "BookingStatusHistory"("bookingId");

-- CreateIndex
CREATE INDEX "BookingStatusHistory_toStatus_idx" ON "BookingStatusHistory"("toStatus");

-- CreateIndex
CREATE INDEX "BookingStatusHistory_createdAt_idx" ON "BookingStatusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "BookingStatusHistory_changedBy_idx" ON "BookingStatusHistory"("changedBy");

-- CreateIndex
CREATE INDEX "StripeCharge_orgId_idx" ON "StripeCharge"("orgId");

-- CreateIndex
CREATE INDEX "StripeCharge_customerId_idx" ON "StripeCharge"("customerId");

-- CreateIndex
CREATE INDEX "StripeCharge_bookingId_idx" ON "StripeCharge"("bookingId");

-- CreateIndex
CREATE INDEX "StripeCharge_status_idx" ON "StripeCharge"("status");

-- CreateIndex
CREATE INDEX "StripeCharge_createdAt_idx" ON "StripeCharge"("createdAt");

-- CreateIndex
CREATE INDEX "StripeCharge_syncedAt_idx" ON "StripeCharge"("syncedAt");

-- CreateIndex
CREATE INDEX "StripeRefund_chargeId_idx" ON "StripeRefund"("chargeId");

-- CreateIndex
CREATE INDEX "StripeRefund_status_idx" ON "StripeRefund"("status");

-- CreateIndex
CREATE INDEX "StripeRefund_createdAt_idx" ON "StripeRefund"("createdAt");

-- CreateIndex
CREATE INDEX "StripePayout_status_idx" ON "StripePayout"("status");

-- CreateIndex
CREATE INDEX "StripePayout_arrivalDate_idx" ON "StripePayout"("arrivalDate");

-- CreateIndex
CREATE INDEX "StripePayout_createdAt_idx" ON "StripePayout"("createdAt");

-- CreateIndex
CREATE INDEX "StripeBalanceTransaction_type_idx" ON "StripeBalanceTransaction"("type");

-- CreateIndex
CREATE INDEX "StripeBalanceTransaction_chargeId_idx" ON "StripeBalanceTransaction"("chargeId");

-- CreateIndex
CREATE INDEX "StripeBalanceTransaction_payoutId_idx" ON "StripeBalanceTransaction"("payoutId");

-- CreateIndex
CREATE INDEX "StripeBalanceTransaction_createdAt_idx" ON "StripeBalanceTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "PayrollRun_payPeriodStart_idx" ON "PayrollRun"("payPeriodStart");

-- CreateIndex
CREATE INDEX "PayrollRun_payPeriodEnd_idx" ON "PayrollRun"("payPeriodEnd");

-- CreateIndex
CREATE INDEX "PayrollRun_status_idx" ON "PayrollRun"("status");

-- CreateIndex
CREATE INDEX "PayrollLineItem_payrollRunId_idx" ON "PayrollLineItem"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollLineItem_sitterId_idx" ON "PayrollLineItem"("sitterId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_payrollRunId_idx" ON "PayrollAdjustment"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_sitterId_idx" ON "PayrollAdjustment"("sitterId");

-- CreateIndex
CREATE INDEX "MessageAccount_orgId_idx" ON "MessageAccount"("orgId");

-- CreateIndex
CREATE INDEX "MessageAccount_provider_idx" ON "MessageAccount"("provider");

-- CreateIndex
CREATE INDEX "MessageNumber_orgId_idx" ON "MessageNumber"("orgId");

-- CreateIndex
CREATE INDEX "MessageNumber_provider_idx" ON "MessageNumber"("provider");

-- CreateIndex
CREATE INDEX "MessageNumber_e164_idx" ON "MessageNumber"("e164");

-- CreateIndex
CREATE INDEX "MessageNumber_status_idx" ON "MessageNumber"("status");

-- CreateIndex
CREATE INDEX "MessageNumber_numberClass_idx" ON "MessageNumber"("numberClass");

-- CreateIndex
CREATE INDEX "MessageNumber_assignedSitterId_idx" ON "MessageNumber"("assignedSitterId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCredential_orgId_key" ON "ProviderCredential"("orgId");

-- CreateIndex
CREATE INDEX "ProviderCredential_orgId_idx" ON "ProviderCredential"("orgId");

-- CreateIndex
CREATE INDEX "MessageThread_orgId_idx" ON "MessageThread"("orgId");

-- CreateIndex
CREATE INDEX "MessageThread_bookingId_idx" ON "MessageThread"("bookingId");

-- CreateIndex
CREATE INDEX "MessageThread_clientId_idx" ON "MessageThread"("clientId");

-- CreateIndex
CREATE INDEX "MessageThread_assignedSitterId_idx" ON "MessageThread"("assignedSitterId");

-- CreateIndex
CREATE INDEX "MessageThread_status_idx" ON "MessageThread"("status");

-- CreateIndex
CREATE INDEX "MessageThread_lastMessageAt_idx" ON "MessageThread"("lastMessageAt");

-- CreateIndex
CREATE INDEX "MessageThread_numberClass_idx" ON "MessageThread"("numberClass");

-- CreateIndex
CREATE INDEX "MessageThread_messageNumberId_idx" ON "MessageThread"("messageNumberId");

-- CreateIndex
CREATE INDEX "MessageThread_assignmentWindowId_idx" ON "MessageThread"("assignmentWindowId");

-- CreateIndex
CREATE INDEX "MessageParticipant_threadId_idx" ON "MessageParticipant"("threadId");

-- CreateIndex
CREATE INDEX "MessageParticipant_orgId_idx" ON "MessageParticipant"("orgId");

-- CreateIndex
CREATE INDEX "MessageParticipant_role_idx" ON "MessageParticipant"("role");

-- CreateIndex
CREATE INDEX "MessageParticipant_userId_idx" ON "MessageParticipant"("userId");

-- CreateIndex
CREATE INDEX "MessageParticipant_clientId_idx" ON "MessageParticipant"("clientId");

-- CreateIndex
CREATE INDEX "MessageEvent_threadId_idx" ON "MessageEvent"("threadId");

-- CreateIndex
CREATE INDEX "MessageEvent_orgId_idx" ON "MessageEvent"("orgId");

-- CreateIndex
CREATE INDEX "MessageEvent_direction_idx" ON "MessageEvent"("direction");

-- CreateIndex
CREATE INDEX "MessageEvent_actorType_idx" ON "MessageEvent"("actorType");

-- CreateIndex
CREATE INDEX "MessageEvent_deliveryStatus_idx" ON "MessageEvent"("deliveryStatus");

-- CreateIndex
CREATE INDEX "MessageEvent_createdAt_idx" ON "MessageEvent"("createdAt");

-- CreateIndex
CREATE INDEX "MessageEvent_providerMessageSid_idx" ON "MessageEvent"("providerMessageSid");

-- CreateIndex
CREATE INDEX "MessageEvent_requiresResponse_idx" ON "MessageEvent"("requiresResponse");

-- CreateIndex
CREATE INDEX "MessageEvent_responseToMessageId_idx" ON "MessageEvent"("responseToMessageId");

-- CreateIndex
CREATE INDEX "MessageEvent_answeredAt_idx" ON "MessageEvent"("answeredAt");

-- CreateIndex
CREATE INDEX "ThreadAssignmentAudit_orgId_idx" ON "ThreadAssignmentAudit"("orgId");

-- CreateIndex
CREATE INDEX "ThreadAssignmentAudit_threadId_idx" ON "ThreadAssignmentAudit"("threadId");

-- CreateIndex
CREATE INDEX "ThreadAssignmentAudit_actorUserId_idx" ON "ThreadAssignmentAudit"("actorUserId");

-- CreateIndex
CREATE INDEX "ThreadAssignmentAudit_createdAt_idx" ON "ThreadAssignmentAudit"("createdAt");

-- CreateIndex
CREATE INDEX "OptOutState_orgId_idx" ON "OptOutState"("orgId");

-- CreateIndex
CREATE INDEX "OptOutState_phoneE164_idx" ON "OptOutState"("phoneE164");

-- CreateIndex
CREATE INDEX "OptOutState_state_idx" ON "OptOutState"("state");

-- CreateIndex
CREATE UNIQUE INDEX "OptOutState_orgId_phoneE164_key" ON "OptOutState"("orgId", "phoneE164");

-- CreateIndex
CREATE INDEX "ResponseRecord_orgId_idx" ON "ResponseRecord"("orgId");

-- CreateIndex
CREATE INDEX "ResponseRecord_threadId_idx" ON "ResponseRecord"("threadId");

-- CreateIndex
CREATE INDEX "ResponseRecord_bookingId_idx" ON "ResponseRecord"("bookingId");

-- CreateIndex
CREATE INDEX "ResponseRecord_responsibleSitterId_idx" ON "ResponseRecord"("responsibleSitterId");

-- CreateIndex
CREATE INDEX "ResponseRecord_resolutionStatus_idx" ON "ResponseRecord"("resolutionStatus");

-- CreateIndex
CREATE INDEX "ResponseRecord_inboundAt_idx" ON "ResponseRecord"("inboundAt");

-- CreateIndex
CREATE UNIQUE INDEX "SitterMaskedNumber_sitterId_key" ON "SitterMaskedNumber"("sitterId");

-- CreateIndex
CREATE UNIQUE INDEX "SitterMaskedNumber_messageNumberId_key" ON "SitterMaskedNumber"("messageNumberId");

-- CreateIndex
CREATE INDEX "SitterMaskedNumber_orgId_idx" ON "SitterMaskedNumber"("orgId");

-- CreateIndex
CREATE INDEX "SitterMaskedNumber_sitterId_idx" ON "SitterMaskedNumber"("sitterId");

-- CreateIndex
CREATE INDEX "SitterMaskedNumber_status_idx" ON "SitterMaskedNumber"("status");

-- CreateIndex
CREATE INDEX "AssignmentWindow_orgId_idx" ON "AssignmentWindow"("orgId");

-- CreateIndex
CREATE INDEX "AssignmentWindow_threadId_idx" ON "AssignmentWindow"("threadId");

-- CreateIndex
CREATE INDEX "AssignmentWindow_bookingId_idx" ON "AssignmentWindow"("bookingId");

-- CreateIndex
CREATE INDEX "AssignmentWindow_sitterId_idx" ON "AssignmentWindow"("sitterId");

-- CreateIndex
CREATE INDEX "AssignmentWindow_status_idx" ON "AssignmentWindow"("status");

-- CreateIndex
CREATE INDEX "AssignmentWindow_startAt_endAt_idx" ON "AssignmentWindow"("startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "AntiPoachingAttempt_eventId_key" ON "AntiPoachingAttempt"("eventId");

-- CreateIndex
CREATE INDEX "AntiPoachingAttempt_orgId_idx" ON "AntiPoachingAttempt"("orgId");

-- CreateIndex
CREATE INDEX "AntiPoachingAttempt_threadId_idx" ON "AntiPoachingAttempt"("threadId");

-- CreateIndex
CREATE INDEX "AntiPoachingAttempt_eventId_idx" ON "AntiPoachingAttempt"("eventId");

-- CreateIndex
CREATE INDEX "AntiPoachingAttempt_action_idx" ON "AntiPoachingAttempt"("action");

-- CreateIndex
CREATE INDEX "SitterTierSnapshot_orgId_sitterId_asOfDate_idx" ON "SitterTierSnapshot"("orgId", "sitterId", "asOfDate" DESC);

-- CreateIndex
CREATE INDEX "SitterTierSnapshot_orgId_asOfDate_idx" ON "SitterTierSnapshot"("orgId", "asOfDate");

-- CreateIndex
CREATE INDEX "SitterTierSnapshot_sitterId_asOfDate_idx" ON "SitterTierSnapshot"("sitterId", "asOfDate" DESC);

-- CreateIndex
CREATE INDEX "SitterTierSnapshot_tier_idx" ON "SitterTierSnapshot"("tier");

-- CreateIndex
CREATE INDEX "SitterTierSnapshot_atRisk_idx" ON "SitterTierSnapshot"("atRisk");

-- CreateIndex
CREATE UNIQUE INDEX "SitterTierSnapshot_orgId_sitterId_asOfDate_key" ON "SitterTierSnapshot"("orgId", "sitterId", "asOfDate");

-- CreateIndex
CREATE INDEX "SitterServiceEvent_orgId_sitterId_createdAt_idx" ON "SitterServiceEvent"("orgId", "sitterId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SitterServiceEvent_orgId_sitterId_effectiveFrom_effectiveTo_idx" ON "SitterServiceEvent"("orgId", "sitterId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "SitterServiceEvent_level_idx" ON "SitterServiceEvent"("level");

-- CreateIndex
CREATE INDEX "SitterServiceEvent_effectiveFrom_effectiveTo_idx" ON "SitterServiceEvent"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "SitterTimeOff_orgId_sitterId_startsAt_endsAt_idx" ON "SitterTimeOff"("orgId", "sitterId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "SitterTimeOff_orgId_sitterId_startsAt_idx" ON "SitterTimeOff"("orgId", "sitterId", "startsAt" DESC);

-- CreateIndex
CREATE INDEX "SitterTimeOff_type_idx" ON "SitterTimeOff"("type");

-- CreateIndex
CREATE INDEX "SitterTimeOff_startsAt_endsAt_idx" ON "SitterTimeOff"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "OfferEvent_orgId_sitterId_offeredAt_idx" ON "OfferEvent"("orgId", "sitterId", "offeredAt" DESC);

-- CreateIndex
CREATE INDEX "OfferEvent_orgId_sitterId_excluded_idx" ON "OfferEvent"("orgId", "sitterId", "excluded");

-- CreateIndex
CREATE INDEX "OfferEvent_orgId_sitterId_status_idx" ON "OfferEvent"("orgId", "sitterId", "status");

-- CreateIndex
CREATE INDEX "OfferEvent_bookingId_idx" ON "OfferEvent"("bookingId");

-- CreateIndex
CREATE INDEX "OfferEvent_threadId_idx" ON "OfferEvent"("threadId");

-- CreateIndex
CREATE INDEX "OfferEvent_offeredAt_idx" ON "OfferEvent"("offeredAt");

-- CreateIndex
CREATE INDEX "OfferEvent_expiresAt_idx" ON "OfferEvent"("expiresAt");

-- CreateIndex
CREATE INDEX "VisitEvent_orgId_sitterId_scheduledStart_idx" ON "VisitEvent"("orgId", "sitterId", "scheduledStart" DESC);

-- CreateIndex
CREATE INDEX "VisitEvent_orgId_sitterId_excluded_idx" ON "VisitEvent"("orgId", "sitterId", "excluded");

-- CreateIndex
CREATE INDEX "VisitEvent_bookingId_idx" ON "VisitEvent"("bookingId");

-- CreateIndex
CREATE INDEX "VisitEvent_threadId_idx" ON "VisitEvent"("threadId");

-- CreateIndex
CREATE INDEX "VisitEvent_scheduledStart_idx" ON "VisitEvent"("scheduledStart");

-- CreateIndex
CREATE INDEX "VisitEvent_status_idx" ON "VisitEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SitterCompensation_sitterId_key" ON "SitterCompensation"("sitterId");

-- CreateIndex
CREATE INDEX "SitterCompensation_orgId_sitterId_idx" ON "SitterCompensation"("orgId", "sitterId");

-- CreateIndex
CREATE INDEX "SitterCompensation_nextReviewDate_idx" ON "SitterCompensation"("nextReviewDate");

-- CreateIndex
CREATE INDEX "SitterMetricsWindow_orgId_sitterId_windowStart_idx" ON "SitterMetricsWindow"("orgId", "sitterId", "windowStart");

-- CreateIndex
CREATE INDEX "SitterMetricsWindow_orgId_sitterId_windowEnd_idx" ON "SitterMetricsWindow"("orgId", "sitterId", "windowEnd");

-- CreateIndex
CREATE INDEX "SitterMetricsWindow_windowType_idx" ON "SitterMetricsWindow"("windowType");

-- CreateIndex
CREATE UNIQUE INDEX "SitterMetricsWindow_orgId_sitterId_windowStart_windowType_key" ON "SitterMetricsWindow"("orgId", "sitterId", "windowStart", "windowType");

-- CreateIndex
CREATE INDEX "MessageResponseLink_orgId_threadId_createdAt_idx" ON "MessageResponseLink"("orgId", "threadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MessageResponseLink_orgId_requiresResponseEventId_idx" ON "MessageResponseLink"("orgId", "requiresResponseEventId");

-- CreateIndex
CREATE INDEX "MessageResponseLink_responseEventId_idx" ON "MessageResponseLink"("responseEventId");

-- CreateIndex
CREATE INDEX "MessageResponseLink_withinAssignmentWindow_excluded_idx" ON "MessageResponseLink"("withinAssignmentWindow", "excluded");

-- CreateIndex
CREATE UNIQUE INDEX "MessageResponseLink_requiresResponseEventId_key" ON "MessageResponseLink"("requiresResponseEventId");

-- CreateIndex
CREATE INDEX "BookingCalendarEvent_orgId_idx" ON "BookingCalendarEvent"("orgId");

-- CreateIndex
CREATE INDEX "BookingCalendarEvent_bookingId_idx" ON "BookingCalendarEvent"("bookingId");

-- CreateIndex
CREATE INDEX "BookingCalendarEvent_sitterId_idx" ON "BookingCalendarEvent"("sitterId");

-- CreateIndex
CREATE INDEX "BookingCalendarEvent_googleCalendarEventId_idx" ON "BookingCalendarEvent"("googleCalendarEventId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingCalendarEvent_bookingId_sitterId_key" ON "BookingCalendarEvent"("bookingId", "sitterId");

-- CreateIndex
CREATE INDEX "LoyaltyReward_orgId_idx" ON "LoyaltyReward"("orgId");

-- CreateIndex
CREATE INDEX "LoyaltyReward_clientId_idx" ON "LoyaltyReward"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyReward_orgId_clientId_key" ON "LoyaltyReward"("orgId", "clientId");

-- CreateIndex
CREATE INDEX "PetHealthLog_petId_idx" ON "PetHealthLog"("petId");

-- CreateIndex
CREATE INDEX "PetHealthLog_sitterId_idx" ON "PetHealthLog"("sitterId");

-- CreateIndex
CREATE INDEX "PetHealthLog_bookingId_idx" ON "PetHealthLog"("bookingId");

-- CreateIndex
CREATE INDEX "PetHealthLog_orgId_idx" ON "PetHealthLog"("orgId");

-- CreateIndex
CREATE INDEX "SitterVerification_sitterId_idx" ON "SitterVerification"("sitterId");

-- CreateIndex
CREATE INDEX "SitterVerification_status_idx" ON "SitterVerification"("status");

-- CreateIndex
CREATE INDEX "AnalyticsInsight_orgId_idx" ON "AnalyticsInsight"("orgId");

-- CreateIndex
CREATE INDEX "AnalyticsInsight_type_idx" ON "AnalyticsInsight"("type");

-- CreateIndex
CREATE INDEX "AnalyticsInsight_generatedAt_idx" ON "AnalyticsInsight"("generatedAt");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSlot" ADD CONSTRAINT "TimeSlot_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sitter" ADD CONSTRAINT "Sitter_currentTierId_fkey" FOREIGN KEY ("currentTierId") REFERENCES "SitterTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterPoolOffer" ADD CONSTRAINT "SitterPoolOffer_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterPoolOffer" ADD CONSTRAINT "SitterPoolOffer_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSitterPool" ADD CONSTRAINT "BookingSitterPool_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSitterPool" ADD CONSTRAINT "BookingSitterPool_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTrigger" ADD CONSTRAINT "AutomationTrigger_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationConditionGroup" ADD CONSTRAINT "AutomationConditionGroup_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationCondition" ADD CONSTRAINT "AutomationCondition_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AutomationConditionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAction" ADD CONSTRAINT "AutomationAction_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTemplate" ADD CONSTRAINT "AutomationTemplate_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRunStep" ADD CONSTRAINT "AutomationRunStep_automationRunId_fkey" FOREIGN KEY ("automationRunId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateHistory" ADD CONSTRAINT "TemplateHistory_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterTierHistory" ADD CONSTRAINT "SitterTierHistory_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterTierHistory" ADD CONSTRAINT "SitterTierHistory_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "SitterTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingTagAssignment" ADD CONSTRAINT "BookingTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "BookingTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingTagAssignment" ADD CONSTRAINT "BookingTagAssignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLineItem" ADD CONSTRAINT "PayrollLineItem_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLineItem" ADD CONSTRAINT "PayrollLineItem_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_assignedSitterId_fkey" FOREIGN KEY ("assignedSitterId") REFERENCES "Sitter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_messageNumberId_fkey" FOREIGN KEY ("messageNumberId") REFERENCES "MessageNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageParticipant" ADD CONSTRAINT "MessageParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_responseToMessageId_fkey" FOREIGN KEY ("responseToMessageId") REFERENCES "MessageEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadAssignmentAudit" ADD CONSTRAINT "ThreadAssignmentAudit_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseRecord" ADD CONSTRAINT "ResponseRecord_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterMaskedNumber" ADD CONSTRAINT "SitterMaskedNumber_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterMaskedNumber" ADD CONSTRAINT "SitterMaskedNumber_messageNumberId_fkey" FOREIGN KEY ("messageNumberId") REFERENCES "MessageNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentWindow" ADD CONSTRAINT "AssignmentWindow_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentWindow" ADD CONSTRAINT "AssignmentWindow_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentWindow" ADD CONSTRAINT "AssignmentWindow_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AntiPoachingAttempt" ADD CONSTRAINT "AntiPoachingAttempt_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AntiPoachingAttempt" ADD CONSTRAINT "AntiPoachingAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MessageEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterTierSnapshot" ADD CONSTRAINT "SitterTierSnapshot_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterServiceEvent" ADD CONSTRAINT "SitterServiceEvent_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterTimeOff" ADD CONSTRAINT "SitterTimeOff_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferEvent" ADD CONSTRAINT "OfferEvent_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferEvent" ADD CONSTRAINT "OfferEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferEvent" ADD CONSTRAINT "OfferEvent_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitEvent" ADD CONSTRAINT "VisitEvent_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitEvent" ADD CONSTRAINT "VisitEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitEvent" ADD CONSTRAINT "VisitEvent_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterCompensation" ADD CONSTRAINT "SitterCompensation_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterMetricsWindow" ADD CONSTRAINT "SitterMetricsWindow_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageResponseLink" ADD CONSTRAINT "MessageResponseLink_requiresResponseEventId_fkey" FOREIGN KEY ("requiresResponseEventId") REFERENCES "MessageEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageResponseLink" ADD CONSTRAINT "MessageResponseLink_responseEventId_fkey" FOREIGN KEY ("responseEventId") REFERENCES "MessageEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageResponseLink" ADD CONSTRAINT "MessageResponseLink_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCalendarEvent" ADD CONSTRAINT "BookingCalendarEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCalendarEvent" ADD CONSTRAINT "BookingCalendarEvent_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyReward" ADD CONSTRAINT "LoyaltyReward_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetHealthLog" ADD CONSTRAINT "PetHealthLog_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetHealthLog" ADD CONSTRAINT "PetHealthLog_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetHealthLog" ADD CONSTRAINT "PetHealthLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterVerification" ADD CONSTRAINT "SitterVerification_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

