/**
 * Focused post-patch verifier for migrated booking UI completeness.
 *
 * Verifies only migrated bookings (derived from migration artifacts),
 * and checks the specific fields/read paths that were previously incomplete:
 * - client linkage
 * - paid fallback eligibility
 * - address read-path inclusion
 * - timeslot read-path inclusion
 *
 * Outputs:
 * - human-readable console summary
 * - JSON artifact:
 *   docs/internal/audit/artifacts/booking-migration/ui-completeness-report.json
 *
 * Exits non-zero if any required condition fails.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type OldBooking = { id: string };
type OldBookingsExport = { bookings: OldBooking[] };

type SampleSummary = {
  id: string;
  existsInMigratedSet: boolean;
  existsInTargetDb: boolean;
  clientLinked: boolean;
  paidFallbackNeeded: boolean;
  pickupPresent: boolean;
  dropoffPresent: boolean;
  multiSlotPresent: boolean;
  failureReason?: string;
};

const prisma = new PrismaClient();

const TARGET_ORG_ID = process.env.MIGRATION_TARGET_ORG_ID || "default";
const ARTIFACT_DIR = path.join(process.cwd(), "docs", "internal", "audit", "artifacts", "booking-migration");
const OLD_EXPORT_PATH = path.join(ARTIFACT_DIR, "old-bookings-export.json");
const REPORT_PATH = path.join(ARTIFACT_DIR, "ui-completeness-report.json");

const OWNER_DETAIL_API_PATH = path.join(process.cwd(), "src", "app", "api", "bookings", "[id]", "route.ts");
const CLIENT_DETAIL_API_PATH = path.join(process.cwd(), "src", "app", "api", "client", "bookings", "[id]", "route.ts");

const REQUIRED_SAMPLE_IDS = [
  "47aed6bd-e335-42e9-ae3b-8f9a657124fe",
  "65a1b4e2-0a06-4f88-be8f-987b86a91f5e",
  "48abcd6d-df79-4458-a2fe-64d54be7fc4b",
];

function hasAll(content: string, needles: string[]) {
  return needles.every((n) => content.includes(n));
}

async function loadMigratedIds(): Promise<string[]> {
  try {
    const raw = await fs.readFile(OLD_EXPORT_PATH, "utf8");
    const parsed = JSON.parse(raw) as OldBookingsExport;
    const ids = (parsed.bookings || []).map((b) => b.id).filter(Boolean);
    return Array.from(new Set(ids));
  } catch {
    return [];
  }
}

async function run() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });

  const migratedIds = await loadMigratedIds();
  if (migratedIds.length === 0) {
    throw new Error(
      `No migrated booking IDs found. Expected export artifact at ${OLD_EXPORT_PATH}`
    );
  }

  // Static read-path checks (API shape support).
  const [ownerApiSource, clientApiSource] = await Promise.all([
    fs.readFile(OWNER_DETAIL_API_PATH, "utf8"),
    fs.readFile(CLIENT_DETAIL_API_PATH, "utf8"),
  ]);

  const ownerIncludesAddressFields = hasAll(ownerApiSource, [
    "pickupAddress",
    "dropoffAddress",
  ]);
  const clientIncludesAddressFields = hasAll(clientApiSource, [
    "pickupAddress",
    "dropoffAddress",
  ]);
  const ownerIncludesTimeSlots = ownerApiSource.includes("timeSlots");

  const ownerHasInferredPaidFallback =
    ownerApiSource.includes("booking.paymentStatus === 'paid'") &&
    ownerApiSource.includes("inferred: true");
  const clientHasInferredPaidFallback =
    clientApiSource.includes("booking.paymentStatus === 'paid'") &&
    clientApiSource.includes("inferred: true");

  // DB checks on migrated set.
  const bookings = await prisma.booking.findMany({
    where: {
      id: { in: migratedIds },
      orgId: TARGET_ORG_ID,
    },
    include: {
      client: { select: { id: true, orgId: true } },
    },
  });

  const bookingById = new Map(bookings.map((b) => [b.id, b]));

  const [slotAgg, chargeAgg] = await Promise.all([
    prisma.timeSlot.groupBy({
      by: ["bookingId"],
      where: { bookingId: { in: migratedIds }, orgId: TARGET_ORG_ID },
      _count: { _all: true },
    }),
    prisma.stripeCharge.groupBy({
      by: ["bookingId"],
      where: { bookingId: { in: migratedIds }, status: "succeeded" },
      _count: { _all: true },
    }),
  ]);
  const slotCountByBookingId = new Map(slotAgg.map((r) => [r.bookingId, r._count._all]));
  const chargeCountByBookingId = new Map(chargeAgg.map((r) => [r.bookingId, r._count._all]));

  let missingClientId = 0;
  let brokenClientRelation = 0;
  let crossOrgClientAnomaly = 0;
  let linkedClients = 0;

  let paidWithCharge = 0;
  let paidWithoutCharge = 0;
  let paidWithoutChargeEligibleFallback = 0;
  let paidWouldRenderNoProofOrFallback = 0;

  let withPickupAddress = 0;
  let withDropoffAddress = 0;
  let addressPathOmissionBookings = 0;

  let withMultiTimeSlots = 0;
  let timeSlotPathOmissionBookings = 0;

  const missingInTargetDb = migratedIds.filter((id) => !bookingById.has(id));

  for (const id of migratedIds) {
    const booking = bookingById.get(id);
    if (!booking) continue;

    // 1) Client linkage
    if (!booking.clientId) {
      missingClientId += 1;
    } else {
      linkedClients += 1;
      if (!booking.client) brokenClientRelation += 1;
      if (booking.client && booking.client.orgId !== TARGET_ORG_ID) crossOrgClientAnomaly += 1;
    }

    // 2) Legacy paid fallback eligibility
    if (booking.paymentStatus === "paid") {
      const chargeCount = chargeCountByBookingId.get(id) || 0;
      if (chargeCount > 0) {
        paidWithCharge += 1;
      } else {
        paidWithoutCharge += 1;
        if (ownerHasInferredPaidFallback && clientHasInferredPaidFallback) {
          paidWithoutChargeEligibleFallback += 1;
        } else {
          paidWouldRenderNoProofOrFallback += 1;
        }
      }
    }

    // 3) Address completeness path
    const hasPickup = Boolean(booking.pickupAddress);
    const hasDropoff = Boolean(booking.dropoffAddress);
    if (hasPickup) withPickupAddress += 1;
    if (hasDropoff) withDropoffAddress += 1;
    if ((hasPickup || hasDropoff) && (!ownerIncludesAddressFields || !clientIncludesAddressFields)) {
      addressPathOmissionBookings += 1;
    }

    // 4) TimeSlot completeness path (owner detail)
    const slotCount = slotCountByBookingId.get(id) || 0;
    if (slotCount > 1) {
      withMultiTimeSlots += 1;
      if (!ownerIncludesTimeSlots) {
        timeSlotPathOmissionBookings += 1;
      }
    }
  }

  // 5) Sample-based regression proof
  const sampleChecks: SampleSummary[] = REQUIRED_SAMPLE_IDS.map((id) => {
    const inSet = migratedIds.includes(id);
    const booking = bookingById.get(id);
    const exists = Boolean(booking);
    if (!inSet || !booking) {
      return {
        id,
        existsInMigratedSet: inSet,
        existsInTargetDb: exists,
        clientLinked: false,
        paidFallbackNeeded: false,
        pickupPresent: false,
        dropoffPresent: false,
        multiSlotPresent: false,
        failureReason: !inSet ? "id_not_in_migrated_set" : "id_not_found_in_target_db",
      };
    }

    const chargeCount = chargeCountByBookingId.get(id) || 0;
    const paidFallbackNeeded = booking.paymentStatus === "paid" && chargeCount === 0;
    const slotCount = slotCountByBookingId.get(id) || 0;

    const failures: string[] = [];
    if (!booking.clientId || !booking.client) failures.push("client_link_missing");
    if (paidFallbackNeeded && !(ownerHasInferredPaidFallback && clientHasInferredPaidFallback)) {
      failures.push("paid_fallback_not_available");
    }
    if ((booking.pickupAddress || booking.dropoffAddress) && (!ownerIncludesAddressFields || !clientIncludesAddressFields)) {
      failures.push("address_read_path_omits_fields");
    }
    if (slotCount > 1 && !ownerIncludesTimeSlots) {
      failures.push("timeslot_read_path_omits_fields");
    }

    return {
      id,
      existsInMigratedSet: true,
      existsInTargetDb: true,
      clientLinked: Boolean(booking.clientId && booking.client),
      paidFallbackNeeded,
      pickupPresent: Boolean(booking.pickupAddress),
      dropoffPresent: Boolean(booking.dropoffAddress),
      multiSlotPresent: slotCount > 1,
      ...(failures.length > 0 ? { failureReason: failures.join(",") } : {}),
    };
  });

  const report = {
    targetOrgId: TARGET_ORG_ID,
    generatedAt: new Date().toISOString(),
    migrated: {
      totalIdsFromArtifact: migratedIds.length,
      foundInTargetDb: bookings.length,
      missingInTargetDbCount: missingInTargetDb.length,
      missingInTargetDb,
    },
    readPathChecks: {
      ownerIncludesAddressFields,
      clientIncludesAddressFields,
      ownerIncludesTimeSlots,
      ownerHasInferredPaidFallback,
      clientHasInferredPaidFallback,
    },
    clientLinkage: {
      totalMigratedChecked: bookings.length,
      linkedClients,
      missingClientId,
      brokenClientRelation,
      crossOrgClientAnomaly,
    },
    paidFallback: {
      paidWithCharge,
      paidWithoutCharge,
      paidWithoutChargeEligibleFallback,
      paidWouldRenderNoProofOrFallback,
    },
    addresses: {
      withPickupAddress,
      withDropoffAddress,
      addressPathOmissionBookings,
    },
    timeSlots: {
      withMultiTimeSlots,
      timeSlotPathOmissionBookings,
    },
    samples: sampleChecks,
  };

  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  // Human-readable summary
  console.log("\n=== Migrated Booking UI Completeness ===");
  console.log(`Target org: ${TARGET_ORG_ID}`);
  console.log(`Migrated IDs: ${migratedIds.length}`);
  console.log(`Found in target DB: ${bookings.length}`);
  console.log(`Missing in target DB: ${missingInTargetDb.length}`);
  console.log("");
  console.log("Client linkage:");
  console.log(`  linked: ${linkedClients}`);
  console.log(`  missing clientId: ${missingClientId}`);
  console.log(`  broken relation: ${brokenClientRelation}`);
  console.log(`  cross-org anomalies: ${crossOrgClientAnomaly}`);
  console.log("");
  console.log("Paid fallback:");
  console.log(`  paid with charge: ${paidWithCharge}`);
  console.log(`  paid without charge: ${paidWithoutCharge}`);
  console.log(`  paid without charge eligible fallback: ${paidWithoutChargeEligibleFallback}`);
  console.log(`  paid with no proof/fallback (fatal): ${paidWouldRenderNoProofOrFallback}`);
  console.log("");
  console.log("Address read path:");
  console.log(`  with pickupAddress: ${withPickupAddress}`);
  console.log(`  with dropoffAddress: ${withDropoffAddress}`);
  console.log(`  address path omissions (fatal): ${addressPathOmissionBookings}`);
  console.log("");
  console.log("TimeSlot read path:");
  console.log(`  bookings with >1 timeslot: ${withMultiTimeSlots}`);
  console.log(`  timeslot path omissions (fatal): ${timeSlotPathOmissionBookings}`);
  console.log("");
  console.log("Sample proof:");
  for (const s of sampleChecks) {
    console.log(
      `  ${s.id} | clientLinked=${s.clientLinked} | paidFallbackNeeded=${s.paidFallbackNeeded} | pickup=${s.pickupPresent} | dropoff=${s.dropoffPresent} | multiSlot=${s.multiSlotPresent}${s.failureReason ? ` | FAIL=${s.failureReason}` : ""}`
    );
  }
  console.log(`\nReport written: ${REPORT_PATH}`);

  const shouldFail =
    missingClientId > 0 ||
    brokenClientRelation > 0 ||
    addressPathOmissionBookings > 0 ||
    timeSlotPathOmissionBookings > 0 ||
    paidWouldRenderNoProofOrFallback > 0;

  await prisma.$disconnect();
  if (shouldFail) process.exit(2);
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

