/**
 * Verification script for OLD -> NEW booking migration.
 *
 * Compares source booking data from OLD API with target booking data in current DB.
 * Produces mismatch reports for key fields and relation counts.
 *
 * Usage:
 *   tsx scripts/verify-old-dashboard-bookings-migration.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type OldPet = {
  id?: string;
  name?: string | null;
  species?: string | null;
  breed?: string | null;
  age?: number | null;
  notes?: string | null;
};

type OldTimeSlot = {
  id?: string;
  startAt?: string | null;
  endAt?: string | null;
  duration?: number | null;
};

type OldBooking = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  service?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  totalPrice?: number | null;
  status?: string | null;
  assignmentType?: string | null;
  notes?: string | null;
  stripePaymentLinkUrl?: string | null;
  tipLinkUrl?: string | null;
  paymentStatus?: string | null;
  createdAt?: string | null;
  afterHours?: boolean | null;
  holiday?: boolean | null;
  quantity?: number | null;
  sitterId?: string | null;
  clientId?: string | null;
  pets?: OldPet[] | null;
  timeSlots?: OldTimeSlot[] | null;
};

type OldBookingsResponse = { bookings: OldBooking[] };

const prisma = new PrismaClient();
const OLD_BASE_URL = process.env.OLD_DASHBOARD_URL || "https://backend-291r.onrender.com";
const TARGET_ORG_ID = process.env.MIGRATION_TARGET_ORG_ID || "default";
const OUT_DIR = path.join(process.cwd(), "docs", "internal", "audit", "artifacts", "booking-migration");
const VERIFY_REPORT_PATH = path.join(OUT_DIR, "verification-report.json");

function normalizeText(v: string | null | undefined) {
  const x = (v || "").trim();
  return x.length ? x : null;
}

function toIso(v: string | Date | null | undefined) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${url}: ${res.status}`);
  return (await res.json()) as T;
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const oldResponse = await fetchJson<OldBookingsResponse>(`${OLD_BASE_URL}/api/bookings`);
  const oldBookings = oldResponse.bookings || [];
  const ids = oldBookings.map((b) => b.id);

  const target = await prisma.booking.findMany({
    where: { id: { in: ids }, orgId: TARGET_ORG_ID },
    include: {
      pets: { orderBy: { id: "asc" } },
      timeSlots: { orderBy: { id: "asc" } },
    },
  });
  const targetById = new Map(target.map((b) => [b.id, b]));

  const missingInTarget: string[] = [];
  const mismatches: Array<{ bookingId: string; fields: string[] }> = [];
  let fullyMatched = 0;
  let unresolvedSitterLinks = 0;
  let unresolvedClientLinks = 0;

  for (const src of oldBookings) {
    const trg = targetById.get(src.id);
    if (!trg) {
      missingInTarget.push(src.id);
      continue;
    }
    const fieldMismatches: string[] = [];

    if ((normalizeText(src.firstName) || "Unknown") !== trg.firstName) fieldMismatches.push("firstName");
    if ((normalizeText(src.lastName) || "Unknown") !== trg.lastName) fieldMismatches.push("lastName");
    if ((normalizeText(src.phone) || "") !== trg.phone) fieldMismatches.push("phone");
    if (normalizeText(src.email) !== normalizeText(trg.email)) fieldMismatches.push("email");
    if (normalizeText(src.address) !== normalizeText(trg.address)) fieldMismatches.push("address");
    if (normalizeText(src.pickupAddress) !== normalizeText(trg.pickupAddress)) fieldMismatches.push("pickupAddress");
    if (normalizeText(src.dropoffAddress) !== normalizeText(trg.dropoffAddress)) fieldMismatches.push("dropoffAddress");
    if ((normalizeText(src.service) || "Drop-ins") !== trg.service) fieldMismatches.push("service");
    if (toIso(src.startAt) !== trg.startAt.toISOString()) fieldMismatches.push("startAt");
    if (toIso(src.endAt) !== trg.endAt.toISOString()) fieldMismatches.push("endAt");
    if ((src.totalPrice ?? 0) !== Number(trg.totalPrice)) fieldMismatches.push("totalPrice");
    if ((normalizeText(src.status) || "pending") !== trg.status) fieldMismatches.push("status");
    if (normalizeText(src.assignmentType) !== normalizeText(trg.assignmentType)) fieldMismatches.push("assignmentType");
    if (normalizeText(src.notes) !== normalizeText(trg.notes)) fieldMismatches.push("notes");
    if (normalizeText(src.stripePaymentLinkUrl) !== normalizeText(trg.stripePaymentLinkUrl)) fieldMismatches.push("stripePaymentLinkUrl");
    if (normalizeText(src.tipLinkUrl) !== normalizeText(trg.tipLinkUrl)) fieldMismatches.push("tipLinkUrl");
    if ((normalizeText(src.paymentStatus) || "unpaid") !== trg.paymentStatus) fieldMismatches.push("paymentStatus");
    if ((src.afterHours ?? false) !== trg.afterHours) fieldMismatches.push("afterHours");
    if ((src.holiday ?? false) !== trg.holiday) fieldMismatches.push("holiday");
    if ((src.quantity ?? 1) !== trg.quantity) fieldMismatches.push("quantity");
    if (normalizeText(src.sitterId) !== normalizeText(trg.sitterId)) fieldMismatches.push("sitterId");
    if (normalizeText(src.clientId) !== normalizeText(trg.clientId)) fieldMismatches.push("clientId");

    const srcPets = src.pets || [];
    if (srcPets.length !== trg.pets.length) {
      fieldMismatches.push("pets.length");
    } else {
      const trgPetsById = new Map(trg.pets.map((p) => [p.id, p]));
      for (const srcPet of srcPets) {
        if (!srcPet.id) {
          fieldMismatches.push("pets.id_missing_in_source");
          break;
        }
        const pet = trgPetsById.get(srcPet.id);
        if (!pet) {
          fieldMismatches.push("pets.id_not_found");
          break;
        }
        if (
          normalizeText(srcPet.name) !== normalizeText(pet.name) ||
          normalizeText(srcPet.species) !== normalizeText(pet.species) ||
          normalizeText(srcPet.breed) !== normalizeText(pet.breed) ||
          (srcPet.age ?? null) !== (pet.age ?? null) ||
          normalizeText(srcPet.notes) !== normalizeText(pet.notes)
        ) {
          fieldMismatches.push("pets.value_mismatch");
          break;
        }
      }
    }

    const srcSlots = src.timeSlots || [];
    if (srcSlots.length !== trg.timeSlots.length) {
      fieldMismatches.push("timeSlots.length");
    } else {
      const trgSlotsById = new Map(trg.timeSlots.map((t) => [t.id, t]));
      for (const srcSlot of srcSlots) {
        if (!srcSlot.id) {
          fieldMismatches.push("timeSlots.id_missing_in_source");
          break;
        }
        const slot = trgSlotsById.get(srcSlot.id);
        if (!slot) {
          fieldMismatches.push("timeSlots.id_not_found");
          break;
        }
        if (
          toIso(srcSlot.startAt) !== slot.startAt.toISOString() ||
          toIso(srcSlot.endAt) !== slot.endAt.toISOString() ||
          (srcSlot.duration ?? 0) !== slot.duration
        ) {
          fieldMismatches.push("timeSlots.value_mismatch");
          break;
        }
      }
    }

    if (normalizeText(src.sitterId) && !trg.sitterId) unresolvedSitterLinks += 1;
    if (normalizeText(src.clientId) && !trg.clientId) unresolvedClientLinks += 1;

    if (fieldMismatches.length === 0) {
      fullyMatched += 1;
    } else {
      mismatches.push({ bookingId: src.id, fields: fieldMismatches });
    }
  }

  const report = {
    oldBaseUrl: OLD_BASE_URL,
    targetOrgId: TARGET_ORG_ID,
    sourceCount: oldBookings.length,
    targetFoundCount: target.length,
    missingInTargetCount: missingInTarget.length,
    mismatchCount: mismatches.length,
    fullyMatchedCount: fullyMatched,
    unresolvedSitterLinks,
    unresolvedClientLinks,
    missingInTarget,
    mismatches,
    generatedAt: new Date().toISOString(),
  };

  await fs.writeFile(VERIFY_REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));

  await prisma.$disconnect();
  if (missingInTarget.length > 0 || mismatches.length > 0) {
    process.exitCode = 2;
  }
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

