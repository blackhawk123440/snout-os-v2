import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { checkRateLimit, getRateLimitIdentifier, rateLimitResponse } from "@/lib/rate-limit";
import { calculateBookingPrice } from "@/lib/rates";
import { formatPhoneForAPI } from "@/lib/phone-format";
import { formatPetsByQuantity, calculatePriceBreakdown, formatDatesAndTimesForMessage, formatDateForMessage, formatTimeForMessage } from "@/lib/booking-utils";
import { sendOwnerAlert } from "@/lib/sms-templates";
import { getOwnerPhone } from "@/lib/phone-utils";
// Phase 3.3: Removed direct automation execution imports - automations now go through queue
import { emitBookingCreated } from "@/lib/event-emitter";
import { emitAndEnqueueBookingEvent } from "@/lib/booking/booking-events";
import { env } from "@/lib/env";
import { validateAndMapFormPayload } from "@/lib/form-to-booking-mapper";
import { extractRequestMetadata, redactMappingReport } from "@/lib/form-mapper-helpers";
// Phase 2: Pricing engine v1
import { calculateCanonicalPricing, type PricingEngineInput } from "@/lib/pricing-engine-v1";
import { compareAndLogPricing } from "@/lib/pricing-parity-harness";
import { serializePricingSnapshot } from "@/lib/pricing-snapshot-helpers";
import { enqueueCalendarSync } from "@/lib/calendar-queue";
import { ensureEventQueueBridge } from "@/lib/event-queue-bridge-init";
import { getPublicOrgContext } from "@/lib/request-context";
import { syncConversationLifecycleWithBookingWorkflow } from "@/lib/messaging/conversation-service";
import { logEvent } from "@/lib/log-event";

const parseOrigins = (value?: string | null) => {
  if (!value) return [];
  return value
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
};

const ALLOWED_ORIGINS = [
  "https://snout-form.onrender.com",
  "https://backend-291r.onrender.com",
  "https://www.snoutservices.com",
  "https://snoutservices.com",
  "https://leahs-supercool-site-c731e5.webflow.io",
  ...parseOrigins(process.env.NEXT_PUBLIC_WEBFLOW_ORIGIN),
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXT_PUBLIC_BASE_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.RENDER_EXTERNAL_URL,
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean) as string[];

const buildCorsHeaders = (request: NextRequest) => {
  const origin = request.headers.get("origin");
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin || "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
  };
};

const FORM_ROUTE = "/api/form";

type IdempotencyRecord = {
  id: string;
  requestFingerprint: string;
  reservationStatus: "reserved" | "completed" | "failed";
  statusCode: number | null;
  responseBodyJson: string | null;
  resourceType: string | null;
  resourceId: string | null;
  updatedAt: Date;
};

const IDEMPOTENCY_STALE_MS = 30_000;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function computeRequestFingerprint(material: Record<string, unknown>): string {
  const canonical = stableStringify(material);
  return createHash("sha256").update(canonical).digest("hex");
}

function parseStoredResponse(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

async function rebuildResponseFromBooking(bookingId: string): Promise<Record<string, unknown> | null> {
  const booking = await (prisma as any).booking.findUnique({
    where: { id: bookingId },
    select: { id: true, totalPrice: true, status: true, notes: true },
  });
  if (!booking) return null;
  return {
    success: true,
    booking: {
      id: booking.id,
      totalPrice: Number(booking.totalPrice),
      status: booking.status,
      notes: booking.notes || null,
    },
  };
}

async function waitForCompletedRecord(recordId: string): Promise<IdempotencyRecord | null> {
  for (let i = 0; i < 20; i++) {
    const existing = await (prisma as any).bookingRequestIdempotency.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        requestFingerprint: true,
        reservationStatus: true,
        statusCode: true,
        responseBodyJson: true,
        resourceType: true,
        resourceId: true,
        updatedAt: true,
      },
    });
    if (!existing) return null;
    if (existing.reservationStatus === "completed") return existing;
    if (existing.resourceType === "booking" && existing.resourceId) return existing;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

async function reserveIdempotency(
  orgId: string,
  idempotencyKey: string | null,
  requestFingerprint: string
): Promise<
  | { mode: "none" }
  | { mode: "reserved"; reservationId: string }
  | { mode: "replay"; statusCode: number; responseBody: Record<string, unknown> }
  | { mode: "in_progress" }
  | { mode: "conflict" }
> {
  if (!idempotencyKey) return { mode: "none" };

  const existing = await (prisma as any).bookingRequestIdempotency.findUnique({
    where: {
      org_route_idempotency: {
        orgId,
        route: FORM_ROUTE,
        idempotencyKey,
      },
    },
    select: {
      id: true,
      requestFingerprint: true,
      reservationStatus: true,
      statusCode: true,
      responseBodyJson: true,
      resourceType: true,
      resourceId: true,
      updatedAt: true,
    },
  });

  if (existing) {
    if (existing.requestFingerprint !== requestFingerprint) return { mode: "conflict" };
    if (existing.reservationStatus === "completed" && existing.statusCode != null) {
      return {
        mode: "replay",
        statusCode: existing.statusCode,
        responseBody: parseStoredResponse(existing.responseBodyJson),
      };
    }
    if (existing.resourceType === "booking" && existing.resourceId) {
      const rebuilt = await rebuildResponseFromBooking(existing.resourceId);
      if (rebuilt) {
        return { mode: "replay", statusCode: existing.statusCode ?? 200, responseBody: rebuilt };
      }
    }
    if (existing.reservationStatus === "failed") {
      await (prisma as any).bookingRequestIdempotency.update({
        where: { id: existing.id },
        data: {
          reservationStatus: "reserved",
          statusCode: null,
          responseBodyJson: null,
          resourceType: null,
          resourceId: null,
        },
      });
      return { mode: "reserved", reservationId: existing.id };
    }
    const staleCutoff = new Date(Date.now() - IDEMPOTENCY_STALE_MS);
    if (existing.reservationStatus === "reserved" && existing.updatedAt < staleCutoff) {
      const recovered = await (prisma as any).bookingRequestIdempotency.updateMany({
        where: {
          id: existing.id,
          reservationStatus: "reserved",
          updatedAt: { lt: staleCutoff },
        },
        data: {
          reservationStatus: "reserved",
          statusCode: null,
          responseBodyJson: null,
        },
      });
      if (recovered.count > 0) {
        return { mode: "reserved", reservationId: existing.id };
      }
    }
    const completed = await waitForCompletedRecord(existing.id);
    if (!completed) return { mode: "in_progress" };
    if (completed.resourceType === "booking" && completed.resourceId) {
      const rebuilt = await rebuildResponseFromBooking(completed.resourceId);
      if (rebuilt) {
        return { mode: "replay", statusCode: completed.statusCode ?? 200, responseBody: rebuilt };
      }
    }
    return {
      mode: "replay",
      statusCode: completed.statusCode ?? 200,
      responseBody: parseStoredResponse(completed.responseBodyJson),
    };
  }

  try {
    const created = await (prisma as any).bookingRequestIdempotency.create({
      data: {
        orgId,
        route: FORM_ROUTE,
        idempotencyKey,
        requestFingerprint,
        reservationStatus: "reserved",
      },
      select: { id: true },
    });
    return { mode: "reserved", reservationId: created.id };
  } catch (error: unknown) {
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002")
    ) {
      return reserveIdempotency(orgId, idempotencyKey, requestFingerprint);
    }
    throw error;
  }
}

async function persistIdempotentResult(
  reservationId: string,
  statusCode: number,
  body: Record<string, unknown>,
  resourceId?: string
) {
  await (prisma as any).bookingRequestIdempotency.update({
    where: { id: reservationId },
    data: {
      reservationStatus: "completed",
      statusCode,
      responseBodyJson: JSON.stringify(body),
      resourceType: resourceId ? "booking" : null,
      resourceId: resourceId ?? null,
    },
  });
}

async function persistIdempotentResource(reservationId: string, bookingId: string) {
  await (prisma as any).bookingRequestIdempotency.update({
    where: { id: reservationId },
    data: {
      resourceType: "booking",
      resourceId: bookingId,
    },
  });
}

async function failIdempotentReservation(reservationId: string | null, errorMessage: string) {
  if (!reservationId) return;
  await (prisma as any).bookingRequestIdempotency.updateMany({
    where: { id: reservationId },
    data: {
      reservationStatus: "failed",
      responseBodyJson: JSON.stringify({ error: errorMessage }),
    },
  });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  });
}

export async function POST(request: NextRequest) {
  const id = getRateLimitIdentifier(request);
  const rl = await checkRateLimit(id, { keyPrefix: "form", limit: 20, windowSec: 60 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfter },
      { status: 429, headers: { ...buildCorsHeaders(request), "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  try {
    let orgId: string;
    try {
      const requestHost = request.headers.get("host") || "";
      orgId = getPublicOrgContext(requestHost).orgId;
    } catch (error) {
      return NextResponse.json(
        {
          error: "Public booking is disabled in SaaS mode until org binding is configured",
        },
        { status: 403, headers: buildCorsHeaders(request) }
      );
    }

    const body = await request.json();
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() || null;
    
    // Phase 1: Check feature flag for mapper
    const useMapper = env.ENABLE_FORM_MAPPER_V1 === true;

    if (useMapper) {
      // Phase 1: Use new mapper path
      const metadata = extractRequestMetadata(request);
      const mappingResult = validateAndMapFormPayload(body, metadata);

      if (!mappingResult.success) {
        // Return structured validation errors
        return NextResponse.json(
          {
            error: "Validation failed",
            errors: mappingResult.errors.map((e) => ({
              field: e.field,
              message: e.message,
            })),
          },
          { status: 400, headers: buildCorsHeaders(request) }
        );
      }

      const { input: mappedInput, report } = mappingResult;

      // Log redacted mapping report (no PII)
      const redactedReport = redactMappingReport(report);
      console.log("[Form Mapper V1] Mapping report:", JSON.stringify(redactedReport, null, 2));

      // Extract values from mapped input for pricing calculation (unchanged logic)
      const trimmedService = mappedInput.service;
      const startDate = mappedInput.startAt as Date;
      const endDate = mappedInput.endAt as Date;
      
      // Extract pets array - mapper returns plain array, but we need to handle both formats
      let petsArray: Array<{ name: string; species: string }> = [];
      if (Array.isArray(mappedInput.pets)) {
        // Mapper returns plain array
        petsArray = mappedInput.pets;
      } else if ((mappedInput.pets as any)?.create) {
        // Prisma nested create format
        const petsCreateValue = (mappedInput.pets as any).create;
        petsArray = Array.isArray(petsCreateValue)
          ? petsCreateValue
          : petsCreateValue ? [petsCreateValue] : [];
      }
      const petsCount = petsArray.length || 0;
      const quantity = mappedInput.quantity || 1;
      const afterHours = mappedInput.afterHours || false;

      // Calculate price using existing pricing logic (unchanged)
      const priceCalculation = await calculateBookingPrice(
        trimmedService,
        startDate,
        endDate,
        petsCount,
        quantity,
        afterHours
      );

      // Build time slots array from mapped input if present - handle both plain array and Prisma format
      let timeSlotsArray: Array<{ startAt: string | Date; endAt: string | Date; duration?: number }> = [];
      if (Array.isArray(mappedInput.timeSlots)) {
        // Mapper returns plain array
        timeSlotsArray = mappedInput.timeSlots;
      } else if ((mappedInput.timeSlots as any)?.create) {
        // Prisma nested create format
        const timeSlotsCreateValue = (mappedInput.timeSlots as any).create;
        timeSlotsArray = Array.isArray(timeSlotsCreateValue)
          ? timeSlotsCreateValue
          : timeSlotsCreateValue ? [timeSlotsCreateValue] : [];
      }
      const timeSlotsData = timeSlotsArray.map((slot: { startAt: string | Date; endAt: string | Date; duration?: number }) => ({
        startAt: slot.startAt instanceof Date ? slot.startAt : new Date(slot.startAt),
        endAt: slot.endAt instanceof Date ? slot.endAt : new Date(slot.endAt),
        duration: slot.duration ?? 0, // Provide default duration if undefined
      }));

      // Phase 2: Check feature flag for pricing engine
      const usePricingEngine = env.USE_PRICING_ENGINE_V1 === true;
      
      let totalPrice: number;
      let pricingSnapshot: string | undefined;
      
      if (usePricingEngine) {
        // Phase 2: Use new canonical pricing engine
        const pricingInput: PricingEngineInput = {
          service: trimmedService,
          startAt: startDate,
          endAt: endDate,
          pets: petsArray.map((pet: { name: string; species: string }) => ({ species: pet.species })),
          quantity,
          afterHours,
          holiday: priceCalculation.holidayApplied,
          timeSlots: timeSlotsData,
        };
        
        const canonicalBreakdown = calculateCanonicalPricing(pricingInput);
        totalPrice = canonicalBreakdown.total;
        pricingSnapshot = serializePricingSnapshot(canonicalBreakdown);
        
        // Phase 2: Run parity comparison (logs differences, does not change charges)
        compareAndLogPricing(pricingInput);
      } else {
        // Existing logic (unchanged when flag is false)
        const breakdown = calculatePriceBreakdown({
          service: trimmedService,
          startAt: startDate,
          endAt: endDate,
          pets: petsArray.map((pet: { name: string; species: string }) => ({ species: pet.species })),
          quantity,
          afterHours,
          holiday: priceCalculation.holidayApplied,
          timeSlots: timeSlotsData,
        });
        totalPrice = breakdown.total;
        
        // Phase 2: Enable parity logging even when flag is false
        // Per Sprint A Step 1: Collect comparison data without changing behavior
        const pricingInput: PricingEngineInput = {
          service: trimmedService,
          startAt: startDate,
          endAt: endDate,
          pets: petsArray.map((pet: { name: string; species: string }) => ({ species: pet.species })),
          quantity,
          afterHours,
          holiday: priceCalculation.holidayApplied,
          timeSlots: timeSlotsData,
        };
        // Run parity comparison (logs differences, does not change charges)
        compareAndLogPricing(pricingInput);
      }

      // Merge mapped input with calculated price (mapper sets totalPrice to 0, we override it)
      // Convert pets and timeSlots to Prisma format if they're plain arrays
      const { pets: _pets, timeSlots: _timeSlots, ...mappedInputWithoutRelations } = mappedInput;
      const bookingData = {
        ...mappedInputWithoutRelations,
        orgId,
        totalPrice, // Use calculated price (from new engine or old logic)
        ...(pricingSnapshot && { pricingSnapshot }), // Store snapshot if using new engine
        // Convert pets to Prisma nested create format
        pets: {
          create: petsArray.map((pet: { name: string; species: string }) => ({
            orgId,
            name: (pet.name || "Pet").trim(),
            species: (pet.species || "Dog").trim(),
          })),
        },
        // Convert timeSlots to Prisma nested create format
        ...(timeSlotsData.length > 0 && {
          timeSlots: {
            create: timeSlotsData.map(slot => ({
              orgId,
              startAt: slot.startAt,
              endAt: slot.endAt,
              duration: slot.duration,
            })),
          },
        }),
      };

      // ── Outstanding balance check — block new bookings if client has unpaid ones ──
      try {
        const existingClientForBalance = await (prisma as any).client.findFirst({
          where: { orgId, phone: mappedInput.phone },
          select: { id: true },
        });
        if (existingClientForBalance) {
          const { checkOutstandingBalance } = await import('@/lib/outstanding-balance');
          const balance = await checkOutstandingBalance({ orgId, clientId: existingClientForBalance.id });
          if (balance.hasOutstanding) {
            return NextResponse.json({
              error: 'outstanding_balance',
              message: `You have an outstanding balance of $${balance.totalOutstanding.toFixed(2)}. Please pay existing bookings before creating new ones.`,
              outstandingBookings: balance.bookings,
            }, { status: 402, headers: buildCorsHeaders(request) });
          }
        }
      } catch (balanceError) {
        console.error('[Form] Outstanding balance check failed (non-blocking):', balanceError);
      }

      // Create booking using mapped input (unchanged persistence logic)
      // Note: booking model exists in main app schema, not enterprise-messaging-dashboard schema
      // Using type assertion to access booking model
      const requestFingerprint = computeRequestFingerprint({
        firstName: bookingData.firstName,
        lastName: bookingData.lastName,
        phone: bookingData.phone,
        email: bookingData.email,
        service: bookingData.service,
        startAt: bookingData.startAt instanceof Date ? bookingData.startAt.toISOString() : bookingData.startAt,
        endAt: bookingData.endAt instanceof Date ? bookingData.endAt.toISOString() : bookingData.endAt,
        address: bookingData.address,
        pickupAddress: bookingData.pickupAddress,
        dropoffAddress: bookingData.dropoffAddress,
        notes: bookingData.notes,
        quantity: bookingData.quantity,
        afterHours: bookingData.afterHours,
        pets: petsArray,
        timeSlots: timeSlotsData.map((slot) => ({
          startAt: slot.startAt.toISOString(),
          endAt: slot.endAt.toISOString(),
          duration: slot.duration,
        })),
      });
      const idempotency = await reserveIdempotency(orgId, idempotencyKey, requestFingerprint);
      if (idempotency.mode === "conflict") {
        return NextResponse.json(
          { error: "Idempotency key conflict: payload does not match original request." },
          { status: 409, headers: buildCorsHeaders(request) }
        );
      }
      if (idempotency.mode === "replay") {
        return NextResponse.json(idempotency.responseBody, {
          status: idempotency.statusCode,
          headers: {
            ...buildCorsHeaders(request),
            "X-Idempotency-Replayed": "true",
          },
        });
      }
      if (idempotency.mode === "in_progress") {
        return NextResponse.json(
          { error: "Request with this idempotency key is still processing. Retry shortly." },
          { status: 409, headers: buildCorsHeaders(request) }
        );
      }

      let booking;
      try {
        booking = await (prisma as any).booking.create({
        data: bookingData,
        include: {
          pets: true,
          timeSlots: true,
        },
      });
      if (idempotency.mode === "reserved") {
        await persistIdempotentResource(idempotency.reservationId, booking.id);
      }
      } catch (error) {
        await failIdempotentReservation(
          idempotency.mode === "reserved" ? idempotency.reservationId : null,
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      }

      // ── Find or create client account (BEFORE lifecycle sync and notifications) ──
      let clientId = booking.clientId;
      try {
        if (!clientId) {
          // Look up existing client by phone
          const existingClient = await (prisma as any).client.findFirst({
            where: { orgId, phone: booking.phone },
            select: { id: true },
          });

          if (existingClient) {
            clientId = existingClient.id;
          } else {
            // Create new client
            const { randomUUID } = await import('node:crypto');
            const welcomeToken = randomUUID();
            const newClient = await (prisma as any).client.create({
              data: {
                orgId,
                firstName: booking.firstName,
                lastName: booking.lastName,
                phone: booking.phone,
                email: booking.email || null,
                address: booking.address || null,
              },
            });
            clientId = newClient.id;

            // Create user account (check if user already exists for this email/phone)
            const existingUser = await (prisma as any).user.findFirst({
              where: { orgId, OR: [
                ...(booking.email ? [{ email: booking.email }] : []),
                { clientId: newClient.id },
              ]},
              select: { id: true },
            });

            if (!existingUser) {
              await (prisma as any).user.create({
                data: {
                  orgId,
                  email: booking.email || `client-${newClient.id}@snout.local`,
                  name: `${booking.firstName} ${booking.lastName}`.trim(),
                  role: 'client',
                  clientId: newClient.id,
                  passwordHash: null,
                  welcomeToken,
                  welcomeTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
              });

              // Send welcome email with setup link (fire-and-forget)
              if (booking.email) {
                void import('@/lib/email').then(({ sendEmail }) =>
                  import('@/lib/email-templates').then(({ clientWelcomeEmail }) => {
                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
                    const { subject, html } = clientWelcomeEmail({
                      clientName: booking.firstName || 'there',
                      welcomeUrl: `${baseUrl}/client/setup?token=${welcomeToken}`,
                    });
                    return sendEmail({ to: booking.email, subject, html });
                  })
                ).catch((e) => console.error('[Form] Welcome email failed:', e));
              }
            }
          }

          // Link booking to client
          await (prisma as any).booking.update({
            where: { id: booking.id },
            data: { clientId },
          });
          booking.clientId = clientId;
        }
      } catch (clientError) {
        console.error('[Form] Client account creation failed (non-blocking):', clientError);
      }

      // ── Lifecycle sync (now has real clientId) ──
      try {
        await syncConversationLifecycleWithBookingWorkflow({
          orgId,
          bookingId: booking.id,
          clientId: booking.clientId ?? null,
          phone: booking.phone,
          firstName: booking.firstName,
          lastName: booking.lastName,
          bookingStatus: booking.status,
          sitterId: booking.sitterId,
          serviceWindowStart: booking.startAt,
          serviceWindowEnd: booking.endAt,
        });
      } catch (conversationError) {
        console.error("[Form] Failed to ensure company lane conversation (non-blocking):", conversationError);
      }
      // Log SMS consent if provided (TCPA compliance)
      if (body.smsConsent) {
        void logEvent({
          orgId,
          action: 'client.sms_consent',
          entityType: 'booking',
          entityId: booking.id,
          bookingId: booking.id,
          status: 'success',
          metadata: {
            phone: booking.phone,
            consentedAt: new Date().toISOString(),
            consentSource: 'booking_form',
            consentLanguage: 'v1',
          },
        });
      }

      // ── Pay-first: create Stripe Checkout session ──
      let paymentUrl = null;
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-03-31.basil' as any });

        const isAdvance = booking.startAt && (new Date(booking.startAt).getTime() - Date.now() > 30 * 24 * 60 * 60 * 1000);
        const chargeAmount = isAdvance
          ? Math.round(totalPrice * 0.25 * 100)
          : Math.round(totalPrice * 100);

        if (chargeAmount > 0 && process.env.STRIPE_SECRET_KEY) {
          // Ensure client has Stripe customer
          let stripeCustomerId = null;
          if (booking.clientId) {
            const clientRecord = await (prisma as any).client.findFirst({
              where: { id: booking.clientId },
              select: { stripeCustomerId: true, email: true, phone: true, firstName: true, lastName: true },
            });
            stripeCustomerId = clientRecord?.stripeCustomerId;
            if (!stripeCustomerId && clientRecord) {
              const customer = await stripe.customers.create({
                email: clientRecord.email || undefined,
                phone: clientRecord.phone || undefined,
                name: `${clientRecord.firstName} ${clientRecord.lastName}`.trim() || undefined,
                metadata: { clientId: booking.clientId, orgId },
              });
              stripeCustomerId = customer.id;
              await (prisma as any).client.update({
                where: { id: booking.clientId },
                data: { stripeCustomerId: customer.id },
              });
            }
          }

          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const formatDateShort = (d: Date) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            ...(stripeCustomerId && { customer: stripeCustomerId }),
            line_items: [{
              price_data: {
                currency: 'usd',
                product_data: {
                  name: isAdvance
                    ? `Deposit — ${booking.service} on ${formatDateShort(booking.startAt)}`
                    : `${booking.service} — ${formatDateShort(booking.startAt)}`,
                  description: isAdvance
                    ? '25% non-refundable deposit. Balance due 7 days before service.'
                    : `${petsArray.length} pet(s)`,
                },
                unit_amount: chargeAmount,
              },
              quantity: 1,
            }],
            metadata: {
              bookingId: booking.id,
              orgId,
              clientId: booking.clientId || '',
              bookingType: isAdvance ? 'deposit' : 'standard',
            },
            success_url: `${baseUrl}/client/bookings/${booking.id}?paid=true`,
            cancel_url: `${baseUrl}/client/bookings/${booking.id}?paid=false`,
            expires_after: 7200,
          });

          paymentUrl = session.url;

          await (prisma as any).booking.update({
            where: { id: booking.id },
            data: {
              status: 'pending_payment',
              dispatchStatus: 'held',
              stripeCheckoutSessionId: session.id,
              stripePaymentLinkUrl: session.url,
              paymentDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000),
              depositAmount: isAdvance ? totalPrice * 0.25 : 0,
              balanceDueDate: isAdvance ? new Date(new Date(booking.startAt).getTime() - 7 * 24 * 60 * 60 * 1000) : null,
            },
          });
        }
      } catch (paymentError) {
        console.error('[Form] Stripe checkout creation failed (non-blocking):', paymentError);
        // Booking is still created with status 'pending' — payment link can be sent later
      }

      // Rest of the flow is unchanged (automation, messaging, etc.)
      await ensureEventQueueBridge();
      try {
        await emitBookingCreated(booking);
      } catch (eventError) {
        console.error("[Form] Failed to emit booking created event (non-blocking):", eventError);
      }

      emitAndEnqueueBookingEvent("booking.created", {
        orgId,
        bookingId: booking.id,
        clientId: booking.clientId ?? undefined,
        sitterId: booking.sitterId ?? undefined,
        occurredAt: new Date().toISOString(),
        metadata: {
          service: booking.service,
          status: booking.status,
          firstName: booking.firstName,
          lastName: booking.lastName,
          phone: mappedInput.phone,
        },
      }).catch((err) => console.error("[Form] emitAndEnqueueBookingEvent failed:", err));

      if (booking.sitterId) {
        enqueueCalendarSync({ type: 'upsert', bookingId: booking.id, orgId }).catch((e) =>
          console.error("[Form] calendar sync enqueue failed:", e)
        );
      }

      // Fire-and-forget notifications
      void import('@/lib/notifications/triggers').then(({ notifyClientBookingReceived, notifyOwnerNewBooking }) => {
        notifyClientBookingReceived({
          orgId,
          bookingId: booking.id,
          clientId: booking.clientId ?? '',
          clientFirstName: booking.firstName,
          service: booking.service,
          startAt: booking.startAt,
          phone: booking.phone,
          pets: booking.pets,
          timeSlots: booking.timeSlots,
          totalPrice: Number(booking.totalPrice) || undefined,
          address: booking.address,
          notes: booking.notes,
        });
        notifyOwnerNewBooking({
          orgId,
          bookingId: booking.id,
          clientName: `${booking.firstName} ${booking.lastName}`.trim(),
          service: booking.service,
          startAt: booking.startAt,
        });
      }).catch(() => {});

      // Check slot availability for "limited availability" warning
      let availabilityWarning: string | null = null;
      try {
        const { checkSlotAvailability } = await import('@/lib/booking/slot-availability');
        const slotCheck = await checkSlotAvailability({
          orgId,
          service: booking.service,
          startAt: booking.startAt,
          endAt: booking.endAt,
          excludeBookingId: booking.id,
        });
        if (slotCheck.availableSitterCount <= 1) {
          availabilityWarning = 'Limited availability — book soon to secure your spot!';
        }
      } catch { /* non-blocking */ }

      const responseBody = {
        success: true,
        booking: {
          id: booking.id,
          totalPrice: totalPrice,
          status: booking.status,
          notes: booking.notes || null,
        },
        paymentUrl: paymentUrl || null,
        availabilityWarning,
      };
      if (idempotency.mode === "reserved") {
        await persistIdempotentResult(idempotency.reservationId, 200, responseBody, booking.id);
      }
      return NextResponse.json(responseBody, {
        headers: buildCorsHeaders(request),
      });
    }

    // Existing path when flag is false (unchanged behavior)
    const {
      firstName,
      lastName,
      phone,
      email,
      address,
      pickupAddress,
      dropoffAddress,
      service,
      startAt,
      endAt,
      petNames,
      petSpecies,
      specialInstructions,
      additionalNotes,
      notes, // Also check for direct 'notes' field from form
      selectedDates,
      dateTimes,
    } = body;

    // Debug: Log notes fields to see what's being received
    console.log('Form submission notes fields:', {
      notes,
      specialInstructions,
      additionalNotes,
      notesType: typeof notes,
      hasNotes: !!notes,
      notesValue: notes,
      bodyKeys: Object.keys(body),
      fullBody: JSON.stringify(body, null, 2),
    });

    // Validate required fields with proper trimming
    const trimmedFirstName = firstName?.trim();
    const trimmedLastName = lastName?.trim();
    const trimmedPhone = phone?.trim();
    const trimmedService = service?.trim();
    
    if (!trimmedFirstName || !trimmedLastName || !trimmedPhone || !trimmedService || !startAt || !endAt) {
      return NextResponse.json(
        { error: "Missing required fields: firstName, lastName, phone, service, startAt, and endAt are required" },
        { status: 400, headers: buildCorsHeaders(request) }
      );
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[\d\s\-\(\)+]+$/;
    if (!phoneRegex.test(trimmedPhone)) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400, headers: buildCorsHeaders(request) }
      );
    }

    // Validate email format if provided
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400, headers: buildCorsHeaders(request) }
        );
      }
    }

    // Validate date formats
    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format for startAt or endAt" },
        { status: 400, headers: buildCorsHeaders(request) }
      );
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: "endAt must be after startAt" },
        { status: 400, headers: buildCorsHeaders(request) }
      );
    }

    // Validate and normalize service name
    const validServices = ["Dog Walking", "Housesitting", "24/7 Care", "Drop-ins", "Pet Taxi"];
    if (!validServices.includes(trimmedService)) {
      return NextResponse.json(
        { error: `Invalid service: ${trimmedService}. Valid services are: ${validServices.join(', ')}` },
        { status: 400, headers: buildCorsHeaders(request) }
      );
    }

    // Validate service-specific required fields
    if (trimmedService === "Pet Taxi") {
      const trimmedPickup = pickupAddress?.trim();
      const trimmedDropoff = dropoffAddress?.trim();
      if (!trimmedPickup || !trimmedDropoff) {
        return NextResponse.json(
          { error: "Pickup and dropoff addresses are required for Pet Taxi service" },
          { status: 400, headers: buildCorsHeaders(request) }
        );
      }
    } else if (trimmedService !== "Housesitting" && trimmedService !== "24/7 Care") {
      // For non-house sitting services, address is required
      const trimmedAddress = address?.trim();
      if (!trimmedAddress) {
        return NextResponse.json(
          { error: "Service address is required" },
          { status: 400, headers: buildCorsHeaders(request) }
        );
      }
    }

    // Create pets array - handle cases where petNames might be undefined or not an array
    // Also handle if pets are sent as an array directly
    let pets: Array<{ name: string; species: string }> = [];
    
    if (Array.isArray(body.pets) && body.pets.length > 0) {
      // Pets are sent as an array of objects with name and species
      pets = body.pets.map((pet: any) => ({
        name: pet.name || "Pet",
        species: pet.species || "Dog",
      }));
    } else if (Array.isArray(petNames) && petNames.length > 0) {
      // Pets are sent as separate arrays for names and species
      pets = petNames.map((name: string, index: number) => ({
        name: name || `Pet ${index + 1}`,
        species: (Array.isArray(petSpecies) ? petSpecies[index] : petSpecies) || "Dog",
      }));
    } else {
      pets = [{ name: "Pet 1", species: "Dog" }]; // Default to one pet if none provided
    }

    // Calculate price
    const priceCalculation = await calculateBookingPrice(
      trimmedService,
      startDate,
      endDate,
      pets.length,
      1, // quantity - will be overridden by timeSlots length if present
      false // afterHours
    );

    // Helper function to convert 12-hour time to 24-hour format
    const convertTo24Hour = (time12h: string): string => {
      if (!time12h) return '09:00:00';
      const [time, modifier] = time12h.split(' ');
      let [hours, minutes] = time.split(':');
      if (hours === '12') hours = '00';
      if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12).padStart(2, '0');
      return `${String(hours).padStart(2, '0')}:${minutes}:00`;
    };

    // Helper function to create a date that preserves local time components
    // The key is to create a date string that represents the local time as if it were UTC
    // This way, when stored in the database (which uses UTC), the time components are preserved
    // When read back, we need to interpret it as local time, not UTC
    const createDateInTimezone = (dateStr: string, time24h: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = time24h.split(':').map(Number);
      
      // Create an ISO string that represents the local time as UTC
      // This ensures the time components (hours, minutes) are preserved when stored
      // Format: YYYY-MM-DDTHH:MM:SS.000Z (the Z means UTC)
      // We're treating the local time as if it were UTC to preserve the components
      const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
      return new Date(isoString);
    };

    // Create timeSlots array from selectedDates and dateTimes
    const timeSlotsData: Array<{ startAt: Date; endAt: Date; duration: number }> = [];
    
    // Handle dateTimes - might be stringified JSON or already an object
    let parsedDateTimes: any = dateTimes;
    if (typeof dateTimes === 'string') {
      try {
        parsedDateTimes = JSON.parse(dateTimes);
      } catch {
        parsedDateTimes = {};
      }
    }
    
    if (selectedDates && Array.isArray(selectedDates) && selectedDates.length > 0 && parsedDateTimes) {
      selectedDates.forEach((dateStr: string) => {
        const times = parsedDateTimes[dateStr];
        if (Array.isArray(times) && times.length > 0) {
          times.forEach((timeEntry: any) => {
            const timeValue = timeEntry?.time || timeEntry?.timeValue || timeEntry;
            const durationValue = timeEntry?.duration || timeEntry?.durationValue || 30;
            
            if (typeof timeValue === 'string' && timeValue.includes(':')) {
              const time24h = convertTo24Hour(timeValue);
              const duration = typeof durationValue === 'number' ? durationValue : 30;
              // Create date using the date and time components directly
              // This preserves the exact time selected by the user
              const startDateTime = createDateInTimezone(dateStr, time24h);
              const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
              
              timeSlotsData.push({
                startAt: startDateTime,
                endAt: endDateTime,
                duration,
              });
            }
          });
        }
      });
    }

    // For house sitting and 24/7 care, calculate quantity based on number of nights
    // For other services, use timeSlots length
    const isHouseSittingService = trimmedService === "Housesitting" || trimmedService === "24/7 Care";
    let quantity: number;
    let bookingStartAt = startAt;
    let bookingEndAt = endAt;
    
    if (isHouseSittingService && selectedDates && Array.isArray(selectedDates) && selectedDates.length > 1) {
      // For house sitting, quantity is number of nights (number of days - 1)
      const sortedDates = [...selectedDates].sort();
      quantity = sortedDates.length - 1;
      
      // Update startAt and endAt to use first and last dates
      const firstDate = sortedDates[0];
      const lastDate = sortedDates[sortedDates.length - 1];
      
      // Get times from first and last dates
      const firstDateTimes = parsedDateTimes[firstDate] || [];
      const lastDateTimes = parsedDateTimes[lastDate] || [];
      
      const firstTime = firstDateTimes.length > 0 ? firstDateTimes[0] : null;
      const lastTime = lastDateTimes.length > 0 ? lastDateTimes[lastDateTimes.length - 1] : null;
      
      if (firstTime && firstTime.time) {
        const time24h = convertTo24Hour(firstTime.time);
        const startDate = createDateInTimezone(firstDate, time24h);
        bookingStartAt = startDate.toISOString();
      } else {
        const startDate = createDateInTimezone(firstDate, '09:00:00');
        bookingStartAt = startDate.toISOString();
      }
      
      if (lastTime && lastTime.time) {
        const time24h = convertTo24Hour(lastTime.time);
        const endDate = createDateInTimezone(lastDate, time24h);
        bookingEndAt = endDate.toISOString();
      } else {
        const endDate = createDateInTimezone(lastDate, '23:59:59');
        bookingEndAt = endDate.toISOString();
      }
    } else {
      // For other services, quantity is number of time slots
      quantity = timeSlotsData.length > 0 ? timeSlotsData.length : 1;
    }
    
    // Phase 2: Check feature flag for pricing engine
    const usePricingEngine = env.USE_PRICING_ENGINE_V1 === true;
    
    let totalPrice: number;
    let pricingSnapshot: string | undefined;
    
    if (usePricingEngine) {
      // Phase 2: Use new canonical pricing engine
      const pricingInput: PricingEngineInput = {
        service: trimmedService,
        startAt: new Date(bookingStartAt),
        endAt: new Date(bookingEndAt),
        pets: pets.map(pet => ({ species: pet.species.trim() })),
        quantity,
        afterHours: false,
        holiday: priceCalculation.holidayApplied,
        timeSlots: timeSlotsData.map(slot => ({
          startAt: slot.startAt,
          endAt: slot.endAt,
          duration: slot.duration,
        })),
      };
      
      const canonicalBreakdown = calculateCanonicalPricing(pricingInput);
      totalPrice = canonicalBreakdown.total;
      pricingSnapshot = serializePricingSnapshot(canonicalBreakdown);
      
      // Phase 2: Run parity comparison (logs differences, does not change charges)
      compareAndLogPricing(pricingInput);
    } else {
      // Existing logic (unchanged when flag is false)
      const breakdown = calculatePriceBreakdown({
        service: trimmedService,
        startAt: new Date(bookingStartAt),
        endAt: new Date(bookingEndAt),
        pets: pets.map(pet => ({ species: pet.species.trim() })),
        quantity,
        afterHours: false,
        holiday: priceCalculation.holidayApplied,
        timeSlots: timeSlotsData.map(slot => ({
          startAt: slot.startAt,
          endAt: slot.endAt,
          duration: slot.duration,
        })),
      });
      totalPrice = breakdown.total;
      
      // Phase 2: Enable parity logging even when flag is false
      // Per Sprint A Step 1: Collect comparison data without changing behavior
      const pricingInput: PricingEngineInput = {
        service: trimmedService,
        startAt: new Date(bookingStartAt),
        endAt: new Date(bookingEndAt),
        pets: pets.map(pet => ({ species: pet.species.trim() })),
        quantity,
        afterHours: false,
        holiday: priceCalculation.holidayApplied,
        timeSlots: timeSlotsData.map(slot => ({
          startAt: slot.startAt,
          endAt: slot.endAt,
          duration: slot.duration,
        })),
      };
      // Run parity comparison (logs differences, does not change charges)
      compareAndLogPricing(pricingInput);
    }

    // Create booking with timeSlots
    const bookingData = {
      orgId,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      phone: formatPhoneForAPI(trimmedPhone),
      email: email ? email.trim() : null,
      address: address ? address.trim() : null,
      pickupAddress: pickupAddress ? pickupAddress.trim() : null,
      dropoffAddress: dropoffAddress ? dropoffAddress.trim() : null,
      service: trimmedService,
      startAt: new Date(bookingStartAt),
      endAt: new Date(bookingEndAt),
      status: "pending",
      totalPrice, // Use calculated price (from new engine or old logic)
      ...(pricingSnapshot && { pricingSnapshot }), // Store snapshot if using new engine
      quantity,
      afterHours: false,
      holiday: priceCalculation.holidayApplied,
      pets: {
        create: pets.map(pet => ({
          orgId,
          name: (pet.name || "Pet").trim(),
          species: (pet.species || "Dog").trim(),
        })),
      },
      // Accept notes from multiple field names: notes, specialInstructions, or additionalNotes
      // Handle all possible cases: undefined, null, empty string, or actual content
      notes: (() => {
        // Check all possible field names - use nullish coalescing to properly handle empty strings
        const notesValue = notes !== undefined ? notes : (specialInstructions !== undefined ? specialInstructions : additionalNotes);
        
        // If we have a value that's not null/undefined, process it
        if (notesValue != null && notesValue !== undefined && notesValue !== '') {
          const trimmed = String(notesValue).trim();
          console.log('Saving notes to database:', {
            originalValue: notesValue,
            trimmedValue: trimmed,
            length: trimmed.length,
            isEmpty: trimmed.length === 0,
          });
          // Only save if there's actual content after trimming
          return trimmed.length > 0 ? trimmed : null;
        }
        
        console.log('No notes provided in form submission:', {
          notes: notes,
          specialInstructions: specialInstructions,
          additionalNotes: additionalNotes,
          allNull: notes == null && specialInstructions == null && additionalNotes == null,
        });
        return null;
      })(),
      timeSlots: timeSlotsData.length > 0
        ? {
            create: timeSlotsData.map(slot => ({
              orgId,
              startAt: slot.startAt,
              endAt: slot.endAt,
              duration: slot.duration,
            })),
          }
        : undefined,
    };

    // Debug: Log what we're about to save
    console.log('Creating booking with notes:', {
      firstName: bookingData.firstName,
      lastName: bookingData.lastName,
      notes: bookingData.notes,
      notesType: typeof bookingData.notes,
      hasNotes: !!bookingData.notes,
    });

    // Note: booking model exists in main app schema, not enterprise-messaging-dashboard schema
    // Using type assertion to access booking model
    const requestFingerprint = computeRequestFingerprint({
      firstName: bookingData.firstName,
      lastName: bookingData.lastName,
      phone: bookingData.phone,
      email: bookingData.email,
      service: bookingData.service,
      startAt: bookingData.startAt.toISOString(),
      endAt: bookingData.endAt.toISOString(),
      address: bookingData.address,
      pickupAddress: bookingData.pickupAddress,
      dropoffAddress: bookingData.dropoffAddress,
      notes: bookingData.notes,
      quantity: bookingData.quantity,
      afterHours: bookingData.afterHours,
      pets,
      timeSlots: timeSlotsData.map((slot) => ({
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
        duration: slot.duration,
      })),
    });
    const idempotency = await reserveIdempotency(orgId, idempotencyKey, requestFingerprint);
    if (idempotency.mode === "conflict") {
      return NextResponse.json(
        { error: "Idempotency key conflict: payload does not match original request." },
        { status: 409, headers: buildCorsHeaders(request) }
      );
    }
    if (idempotency.mode === "replay") {
      return NextResponse.json(idempotency.responseBody, {
        status: idempotency.statusCode,
        headers: {
          ...buildCorsHeaders(request),
          "X-Idempotency-Replayed": "true",
        },
      });
    }
    if (idempotency.mode === "in_progress") {
      return NextResponse.json(
        { error: "Request with this idempotency key is still processing. Retry shortly." },
        { status: 409, headers: buildCorsHeaders(request) }
      );
    }

    let booking;
    try {
      booking = await (prisma as any).booking.create({
      data: bookingData,
      include: {
        pets: true,
        timeSlots: true,
      },
    });
    if (idempotency.mode === "reserved") {
      await persistIdempotentResource(idempotency.reservationId, booking.id);
    }
    } catch (error) {
      await failIdempotentReservation(
        idempotency.mode === "reserved" ? idempotency.reservationId : null,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }

    // ── Find or create client account (BEFORE lifecycle sync and notifications) ──
    {
      let clientId = booking.clientId;
      try {
        if (!clientId) {
          const existingClient = await (prisma as any).client.findFirst({
            where: { orgId, phone: booking.phone },
            select: { id: true },
          });

          if (existingClient) {
            clientId = existingClient.id;
          } else {
            const { randomUUID } = await import('node:crypto');
            const welcomeToken = randomUUID();
            const newClient = await (prisma as any).client.create({
              data: {
                orgId,
                firstName: booking.firstName,
                lastName: booking.lastName,
                phone: booking.phone,
                email: booking.email || null,
                address: booking.address || null,
              },
            });
            clientId = newClient.id;

            const existingUser = await (prisma as any).user.findFirst({
              where: { orgId, OR: [
                ...(booking.email ? [{ email: booking.email }] : []),
                { clientId: newClient.id },
              ]},
              select: { id: true },
            });

            if (!existingUser) {
              await (prisma as any).user.create({
                data: {
                  orgId,
                  email: booking.email || `client-${newClient.id}@snout.local`,
                  name: `${booking.firstName} ${booking.lastName}`.trim(),
                  role: 'client',
                  clientId: newClient.id,
                  passwordHash: null,
                  welcomeToken,
                  welcomeTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
              });
            }
          }

          await (prisma as any).booking.update({
            where: { id: booking.id },
            data: { clientId },
          });
          booking.clientId = clientId;
        }
      } catch (clientError) {
        console.error('[Form] Client account creation failed (non-blocking):', clientError);
      }
    }

    // ── Lifecycle sync (now has real clientId) ──
    try {
      await syncConversationLifecycleWithBookingWorkflow({
        orgId,
        bookingId: booking.id,
        clientId: booking.clientId ?? null,
        phone: booking.phone,
        firstName: booking.firstName,
        lastName: booking.lastName,
        bookingStatus: booking.status,
        sitterId: booking.sitterId,
        serviceWindowStart: booking.startAt,
        serviceWindowEnd: booking.endAt,
      });
    } catch (conversationError) {
      console.error("[Form] Failed to ensure company lane conversation (non-blocking):", conversationError);
    }
    // Log SMS consent if provided (TCPA compliance) - legacy path
    if (body.smsConsent) {
      void logEvent({
        orgId,
        action: 'client.sms_consent',
        entityType: 'booking',
        entityId: booking.id,
        bookingId: booking.id,
        status: 'success',
        metadata: {
          phone: booking.phone,
          consentedAt: new Date().toISOString(),
          consentSource: 'booking_form',
          consentLanguage: 'v1',
        },
      });
    }

    await ensureEventQueueBridge();
    try {
      await emitBookingCreated(booking);
    } catch (eventError) {
      console.error("[Form] Failed to emit booking created event (non-blocking):", eventError);
    }
    emitAndEnqueueBookingEvent("booking.created", {
      orgId,
      bookingId: booking.id,
      clientId: booking.clientId ?? undefined,
      sitterId: booking.sitterId ?? undefined,
      occurredAt: new Date().toISOString(),
      metadata: {
        service: booking.service,
        status: booking.status,
        firstName: booking.firstName,
        lastName: booking.lastName,
        phone: booking.phone,
      },
    }).catch((err) => console.error("[Form] emitAndEnqueueBookingEvent failed:", err));
    if (booking.sitterId) {
      enqueueCalendarSync({ type: 'upsert', bookingId: booking.id, orgId }).catch((e) =>
        console.error("[Form] calendar sync enqueue failed:", e)
      );
    }

    // Fire-and-forget notifications — legacy path
    void import('@/lib/notifications/triggers').then(({ notifyClientBookingReceived, notifyOwnerNewBooking }) => {
      notifyClientBookingReceived({
        orgId,
        bookingId: booking.id,
        clientId: booking.clientId ?? '',
        clientFirstName: booking.firstName,
        service: booking.service,
        startAt: booking.startAt,
        phone: booking.phone,
        pets: booking.pets,
        timeSlots: booking.timeSlots,
        totalPrice: Number(booking.totalPrice) || undefined,
        address: booking.address,
        notes: booking.notes,
      });
      notifyOwnerNewBooking({
        orgId,
        bookingId: booking.id,
        clientName: `${booking.firstName} ${booking.lastName}`.trim(),
        service: booking.service,
        startAt: booking.startAt,
      });
    }).catch(() => {});

    const responseBody = {
      success: true,
      booking: {
        id: booking.id,
        totalPrice: totalPrice,
        status: booking.status,
        notes: booking.notes || null, // Explicitly include notes in response
      },
    };
    if (idempotency.mode === "reserved") {
      await persistIdempotentResult(idempotency.reservationId, 200, responseBody, booking.id);
    }
    return NextResponse.json(responseBody, {
      headers: buildCorsHeaders(request),
    });
  } catch (error) {
    console.error("Failed to create booking:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "Unknown",
    });
    return NextResponse.json(
      { 
        error: "Failed to create booking", 
        details: error instanceof Error ? error.message : String(error),
        ...(process.env.NODE_ENV === 'development' && {
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      { status: 500, headers: buildCorsHeaders(request) }
    );
  }
}
