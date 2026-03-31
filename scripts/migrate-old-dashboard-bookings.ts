/**
 * Booking Migration: OLD dashboard -> NEW dashboard DB
 *
 * Source: OLD deployed API (read-only)
 * Target: current DATABASE_URL (staging/new dashboard DB)
 *
 * Features:
 * - Dry-run and apply modes
 * - Idempotent writes (insert-only by booking.id)
 * - Checkpointing for resumable runs
 * - Structured logs + mismatch/failure reports
 * - Sitter dependency sync (upsert minimal sitters referenced by bookings)
 *
 * Usage:
 *   tsx scripts/migrate-old-dashboard-bookings.ts --dry-run
 *   tsx scripts/migrate-old-dashboard-bookings.ts --apply
 */

import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

type OldPet = {
  id?: string;
  name?: string | null;
  species?: string | null;
  breed?: string | null;
  age?: number | null;
  notes?: string | null;
  bookingId?: string | null;
};

type OldTimeSlot = {
  id?: string;
  startAt?: string | null;
  endAt?: string | null;
  duration?: number | null;
  bookingId?: string | null;
  createdAt?: string | null;
};

type OldSitter = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  active?: boolean | null;
  commissionPercentage?: number | null;
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
  updatedAt?: string | null;
  afterHours?: boolean | null;
  holiday?: boolean | null;
  quantity?: number | null;
  sitterId?: string | null;
  clientId?: string | null;
  pets?: OldPet[] | null;
  timeSlots?: OldTimeSlot[] | null;
  sitter?: { id?: string; firstName?: string; lastName?: string } | null;
};

type OldBookingsResponse = { bookings: OldBooking[] };
type OldSittersResponse = { sitters: OldSitter[] };

type Checkpoint = {
  processedIds: string[];
};

type MigrationLog = {
  at: string;
  level: "info" | "warn" | "error";
  code: string;
  bookingId?: string;
  details?: Record<string, unknown>;
};

const OLD_BASE_URL = process.env.OLD_DASHBOARD_URL || "https://backend-291r.onrender.com";
const TARGET_ORG_ID = process.env.MIGRATION_TARGET_ORG_ID || "default";
const OUT_DIR = path.join(process.cwd(), "docs", "internal", "audit", "artifacts", "booking-migration");
const CHECKPOINT_PATH = path.join(OUT_DIR, "checkpoint.json");
const LOG_PATH = path.join(OUT_DIR, "migration-log.jsonl");
const FAILURE_PATH = path.join(OUT_DIR, "failures.json");
const MISMATCH_PATH = path.join(OUT_DIR, "mismatches.json");
const EXPORT_PATH = path.join(OUT_DIR, "old-bookings-export.json");
const EXPORT_SITTERS_PATH = path.join(OUT_DIR, "old-sitters-export.json");
const SUMMARY_PATH = path.join(OUT_DIR, "summary.json");

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const flags = new Set(argv);
  const isApply = flags.has("--apply");
  const isDryRun = flags.has("--dry-run") || !isApply;
  return { isApply, isDryRun };
}

async function ensureOutDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function appendLog(log: MigrationLog) {
  await fs.appendFile(LOG_PATH, `${JSON.stringify(log)}\n`, "utf8");
}

function toDateOrNull(input?: string | null): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeNonEmpty(input?: string | null): string | null {
  const value = (input || "").trim();
  return value.length > 0 ? value : null;
}

function normalizeBool(input: boolean | null | undefined, fallback = false): boolean {
  if (typeof input === "boolean") return input;
  return fallback;
}

function normalizeNumber(input: number | null | undefined, fallback = 0): number {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  return fallback;
}

function isEquivalentToSnapshot(
  existing: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    address: string | null;
    pickupAddress: string | null;
    dropoffAddress: string | null;
    service: string;
    startAt: Date;
    endAt: Date;
    totalPrice: number;
    status: string;
    assignmentType: string | null;
    notes: string | null;
    stripePaymentLinkUrl: string | null;
    tipLinkUrl: string | null;
    paymentStatus: string;
    afterHours: boolean;
    holiday: boolean;
    quantity: number;
    sitterId: string | null;
    clientId: string | null;
    pets: Array<{ id: string; name: string; species: string; breed: string | null; age: number | null; notes: string | null }>;
    timeSlots: Array<{ id: string; startAt: Date; endAt: Date; duration: number }>;
  },
  snapshot: ReturnType<typeof buildComparableSnapshot>
) {
  const coreEqual =
    existing.firstName === snapshot.firstName &&
    existing.lastName === snapshot.lastName &&
    existing.phone === snapshot.phone &&
    normalizeNonEmpty(existing.email) === normalizeNonEmpty(snapshot.email) &&
    normalizeNonEmpty(existing.address) === normalizeNonEmpty(snapshot.address) &&
    normalizeNonEmpty(existing.pickupAddress) === normalizeNonEmpty(snapshot.pickupAddress) &&
    normalizeNonEmpty(existing.dropoffAddress) === normalizeNonEmpty(snapshot.dropoffAddress) &&
    existing.service === snapshot.service &&
    existing.startAt.toISOString() === snapshot.startAt &&
    existing.endAt.toISOString() === snapshot.endAt &&
    Number(existing.totalPrice) === snapshot.totalPrice &&
    existing.status === snapshot.status &&
    normalizeNonEmpty(existing.assignmentType) === normalizeNonEmpty(snapshot.assignmentType) &&
    normalizeNonEmpty(existing.notes) === normalizeNonEmpty(snapshot.notes) &&
    normalizeNonEmpty(existing.stripePaymentLinkUrl) === normalizeNonEmpty(snapshot.stripePaymentLinkUrl) &&
    normalizeNonEmpty(existing.tipLinkUrl) === normalizeNonEmpty(snapshot.tipLinkUrl) &&
    existing.paymentStatus === snapshot.paymentStatus &&
    existing.afterHours === snapshot.afterHours &&
    existing.holiday === snapshot.holiday &&
    existing.quantity === snapshot.quantity &&
    normalizeNonEmpty(existing.sitterId) === normalizeNonEmpty(snapshot.sitterId) &&
    normalizeNonEmpty(existing.clientId) === normalizeNonEmpty(snapshot.clientId);

  if (!coreEqual) return false;

  if (existing.pets.length !== snapshot.pets.length) return false;
  if (existing.timeSlots.length !== snapshot.timeSlots.length) return false;

  const existingPetsById = new Map(existing.pets.map((p) => [p.id, p]));
  for (const srcPet of snapshot.pets) {
    if (!srcPet.id) continue;
    const targetPet = existingPetsById.get(srcPet.id);
    if (!targetPet) return false;
    if (
      targetPet.name !== srcPet.name ||
      targetPet.species !== srcPet.species ||
      normalizeNonEmpty(targetPet.breed) !== normalizeNonEmpty(srcPet.breed) ||
      (targetPet.age ?? null) !== (srcPet.age ?? null) ||
      normalizeNonEmpty(targetPet.notes) !== normalizeNonEmpty(srcPet.notes)
    ) {
      return false;
    }
  }

  const existingSlotsById = new Map(existing.timeSlots.map((t) => [t.id, t]));
  for (const srcSlot of snapshot.timeSlots) {
    if (!srcSlot.id) continue;
    const targetSlot = existingSlotsById.get(srcSlot.id);
    if (!targetSlot) return false;
    const srcStart = toDateOrNull(srcSlot.startAt);
    const srcEnd = toDateOrNull(srcSlot.endAt);
    if (!srcStart || !srcEnd) return false;
    if (
      targetSlot.startAt.toISOString() !== srcStart.toISOString() ||
      targetSlot.endAt.toISOString() !== srcEnd.toISOString() ||
      targetSlot.duration !== srcSlot.duration
    ) {
      return false;
    }
  }

  return true;
}

function deterministicPetId(bookingId: string, pet: { name: string; species: string }, index: number) {
  const hash = createHash("sha1")
    .update(`${bookingId}:${pet.name}:${pet.species}:${index}`)
    .digest("hex")
    .slice(0, 24);
  return `migrated-pet-${hash}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${url} (${res.status})`);
  }
  return (await res.json()) as T;
}

async function loadCheckpoint(): Promise<Checkpoint> {
  try {
    const raw = await fs.readFile(CHECKPOINT_PATH, "utf8");
    const parsed = JSON.parse(raw) as Checkpoint;
    return { processedIds: Array.isArray(parsed.processedIds) ? parsed.processedIds : [] };
  } catch {
    return { processedIds: [] };
  }
}

async function saveCheckpoint(checkpoint: Checkpoint) {
  await fs.writeFile(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2), "utf8");
}

async function upsertReferencedSitters(oldBookings: OldBooking[], oldSitters: OldSitter[], dryRun: boolean) {
  const referencedIds = new Set(oldBookings.map((b) => b.sitterId).filter(Boolean) as string[]);
  const sourceById = new Map(oldSitters.map((s) => [s.id, s]));
  let createdOrUpdated = 0;
  const missingInSource: string[] = [];

  for (const sitterId of referencedIds) {
    const src = sourceById.get(sitterId);
    if (!src) {
      missingInSource.push(sitterId);
      continue;
    }
    if (dryRun) {
      createdOrUpdated += 1;
      continue;
    }
    await prisma.sitter.upsert({
      where: { id: src.id },
      create: {
        id: src.id,
        orgId: TARGET_ORG_ID,
        firstName: normalizeNonEmpty(src.firstName) || "Unknown",
        lastName: normalizeNonEmpty(src.lastName) || "Sitter",
        phone: normalizeNonEmpty(src.phone) || "",
        email: normalizeNonEmpty(src.email) || `${src.id}@migration.local`,
        active: typeof src.active === "boolean" ? src.active : true,
        commissionPercentage: normalizeNumber(src.commissionPercentage, 80),
      },
      update: {
        firstName: normalizeNonEmpty(src.firstName) || "Unknown",
        lastName: normalizeNonEmpty(src.lastName) || "Sitter",
        phone: normalizeNonEmpty(src.phone) || "",
        email: normalizeNonEmpty(src.email) || `${src.id}@migration.local`,
        active: typeof src.active === "boolean" ? src.active : true,
        commissionPercentage: normalizeNumber(src.commissionPercentage, 80),
      },
    });
    createdOrUpdated += 1;
  }

  return { createdOrUpdated, missingInSource };
}

function buildComparableSnapshot(booking: OldBooking) {
  const pets = (booking.pets || []).map((p) => ({
    id: p.id || null,
    name: normalizeNonEmpty(p.name) || "Pet",
    species: normalizeNonEmpty(p.species) || "Dog",
    breed: normalizeNonEmpty(p.breed),
    age: typeof p.age === "number" ? p.age : null,
    notes: normalizeNonEmpty(p.notes),
  }));
  const timeSlots = (booking.timeSlots || []).map((t) => ({
    id: t.id || null,
    startAt: t.startAt || null,
    endAt: t.endAt || null,
    duration: typeof t.duration === "number" ? t.duration : 0,
    createdAt: t.createdAt || null,
  }));
  return {
    id: booking.id,
    orgId: TARGET_ORG_ID,
    firstName: normalizeNonEmpty(booking.firstName) || "Unknown",
    lastName: normalizeNonEmpty(booking.lastName) || "Unknown",
    phone: normalizeNonEmpty(booking.phone) || "",
    email: normalizeNonEmpty(booking.email),
    address: normalizeNonEmpty(booking.address),
    pickupAddress: normalizeNonEmpty(booking.pickupAddress),
    dropoffAddress: normalizeNonEmpty(booking.dropoffAddress),
    service: normalizeNonEmpty(booking.service) || "Drop-ins",
    startAt: booking.startAt || null,
    endAt: booking.endAt || null,
    totalPrice: normalizeNumber(booking.totalPrice, 0),
    status: normalizeNonEmpty(booking.status) || "pending",
    assignmentType: normalizeNonEmpty(booking.assignmentType),
    notes: normalizeNonEmpty(booking.notes),
    stripePaymentLinkUrl: normalizeNonEmpty(booking.stripePaymentLinkUrl),
    tipLinkUrl: normalizeNonEmpty(booking.tipLinkUrl),
    paymentStatus: normalizeNonEmpty(booking.paymentStatus) || "unpaid",
    createdAt: booking.createdAt || null,
    updatedAt: booking.updatedAt || null,
    afterHours: normalizeBool(booking.afterHours, false),
    holiday: normalizeBool(booking.holiday, false),
    quantity: normalizeNumber(booking.quantity, 1),
    sitterId: normalizeNonEmpty(booking.sitterId),
    clientId: normalizeNonEmpty(booking.clientId),
    pets,
    timeSlots,
  };
}

async function run() {
  const { isApply, isDryRun } = parseArgs(process.argv.slice(2));
  await ensureOutDir();

  await appendLog({
    at: new Date().toISOString(),
    level: "info",
    code: "migration.start",
    details: { mode: isDryRun ? "dry-run" : "apply", oldBaseUrl: OLD_BASE_URL, targetOrgId: TARGET_ORG_ID },
  });

  const [oldBookingsResponse, oldSittersResponse] = await Promise.all([
    fetchJson<OldBookingsResponse>(`${OLD_BASE_URL}/api/bookings`),
    fetchJson<OldSittersResponse>(`${OLD_BASE_URL}/api/sitters`),
  ]);

  const oldBookings = oldBookingsResponse.bookings || [];
  const oldSitters = oldSittersResponse.sitters || [];

  await fs.writeFile(EXPORT_PATH, JSON.stringify(oldBookingsResponse, null, 2), "utf8");
  await fs.writeFile(EXPORT_SITTERS_PATH, JSON.stringify(oldSittersResponse, null, 2), "utf8");

  const checkpoint = await loadCheckpoint();
  const processed = new Set(checkpoint.processedIds);

  const sitterSync = await upsertReferencedSitters(oldBookings, oldSitters, isDryRun);

  const failures: Array<{ bookingId: string; reason: string }> = [];
  const mismatches: Array<{ bookingId: string; reason: string }> = [];
  let created = 0;
  let skipped = 0;
  let duplicateSame = 0;
  let duplicateDifferent = 0;

  for (const oldBooking of oldBookings) {
    if (!oldBooking.id) continue;
    if (processed.has(oldBooking.id)) {
      skipped += 1;
      continue;
    }

    const snapshot = buildComparableSnapshot(oldBooking);
    const startAt = toDateOrNull(snapshot.startAt);
    const endAt = toDateOrNull(snapshot.endAt);
    if (!startAt || !endAt || endAt <= startAt) {
      failures.push({ bookingId: oldBooking.id, reason: "invalid_datetime" });
      await appendLog({
        at: new Date().toISOString(),
        level: "error",
        code: "booking.invalid_datetime",
        bookingId: oldBooking.id,
      });
      continue;
    }

    try {
      const existing = await prisma.booking.findUnique({
        where: { id: oldBooking.id },
        include: {
          pets: {
            orderBy: { id: "asc" },
          },
          timeSlots: {
            orderBy: { id: "asc" },
          },
        },
      });

      if (existing) {
        if (
          isEquivalentToSnapshot(
            {
              firstName: existing.firstName,
              lastName: existing.lastName,
              phone: existing.phone,
              email: existing.email,
              address: existing.address,
              pickupAddress: existing.pickupAddress,
              dropoffAddress: existing.dropoffAddress,
              service: existing.service,
              startAt: existing.startAt,
              endAt: existing.endAt,
              totalPrice: Number(existing.totalPrice),
              status: existing.status,
              assignmentType: existing.assignmentType,
              notes: existing.notes,
              stripePaymentLinkUrl: existing.stripePaymentLinkUrl,
              tipLinkUrl: existing.tipLinkUrl,
              paymentStatus: existing.paymentStatus,
              afterHours: existing.afterHours,
              holiday: existing.holiday,
              quantity: existing.quantity,
              sitterId: existing.sitterId,
              clientId: existing.clientId,
              pets: existing.pets.map((p) => ({
                id: p.id,
                name: p.name,
                species: p.species,
                breed: p.breed,
                age: p.age,
                notes: p.notes,
              })),
              timeSlots: existing.timeSlots.map((t) => ({
                id: t.id,
                startAt: t.startAt,
                endAt: t.endAt,
                duration: t.duration,
              })),
            },
            snapshot
          )
        ) {
          duplicateSame += 1;
        } else {
          duplicateDifferent += 1;
          mismatches.push({ bookingId: oldBooking.id, reason: "existing_record_differs_from_source" });
        }
        processed.add(oldBooking.id);
        continue;
      }

      if (!isApply) {
        created += 1;
        processed.add(oldBooking.id);
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.booking.create({
          data: {
            id: snapshot.id,
            orgId: snapshot.orgId,
            firstName: snapshot.firstName,
            lastName: snapshot.lastName,
            phone: snapshot.phone,
            email: snapshot.email,
            address: snapshot.address,
            pickupAddress: snapshot.pickupAddress,
            dropoffAddress: snapshot.dropoffAddress,
            service: snapshot.service,
            startAt,
            endAt,
            totalPrice: snapshot.totalPrice,
            status: snapshot.status,
            assignmentType: snapshot.assignmentType,
            notes: snapshot.notes,
            stripePaymentLinkUrl: snapshot.stripePaymentLinkUrl,
            tipLinkUrl: snapshot.tipLinkUrl,
            paymentStatus: snapshot.paymentStatus,
            createdAt: toDateOrNull(snapshot.createdAt) || new Date(),
            updatedAt: toDateOrNull(snapshot.updatedAt) || new Date(),
            afterHours: snapshot.afterHours,
            holiday: snapshot.holiday,
            quantity: snapshot.quantity,
            sitterId: snapshot.sitterId,
            clientId: snapshot.clientId,
          },
        });

        if (snapshot.pets.length > 0) {
          await tx.pet.createMany({
            data: snapshot.pets.map((pet, index) => ({
              id: pet.id || deterministicPetId(snapshot.id, pet, index),
              orgId: snapshot.orgId,
              name: pet.name,
              species: pet.species,
              breed: pet.breed,
              age: pet.age,
              notes: pet.notes,
              bookingId: snapshot.id,
            })),
            skipDuplicates: true,
          });
        }

        const validSlots = snapshot.timeSlots
          .map((slot) => ({
            id: slot.id,
            startAt: toDateOrNull(slot.startAt),
            endAt: toDateOrNull(slot.endAt),
            duration: slot.duration,
            createdAt: toDateOrNull(slot.createdAt) || new Date(),
          }))
          .filter((slot): slot is { id: string; startAt: Date; endAt: Date; duration: number; createdAt: Date } =>
            Boolean(slot.id && slot.startAt && slot.endAt)
          );

        if (validSlots.length > 0) {
          await tx.timeSlot.createMany({
            data: validSlots.map((slot) => ({
              id: slot.id,
              orgId: snapshot.orgId,
              bookingId: snapshot.id,
              startAt: slot.startAt,
              endAt: slot.endAt,
              duration: slot.duration,
              createdAt: slot.createdAt,
            })),
            skipDuplicates: true,
          });
        }
      }, { timeout: 60_000, maxWait: 10_000 });

      created += 1;
      processed.add(oldBooking.id);
    } catch (error) {
      failures.push({
        bookingId: oldBooking.id,
        reason: error instanceof Error ? error.message : "unknown_error",
      });
      await appendLog({
        at: new Date().toISOString(),
        level: "error",
        code: "booking.import_failed",
        bookingId: oldBooking.id,
        details: { message: error instanceof Error ? error.message : String(error) },
      });
    }

    if (processed.size % 25 === 0) {
      checkpoint.processedIds = Array.from(processed);
      await saveCheckpoint(checkpoint);
    }
  }

  checkpoint.processedIds = Array.from(processed);
  await saveCheckpoint(checkpoint);
  await fs.writeFile(FAILURE_PATH, JSON.stringify(failures, null, 2), "utf8");
  await fs.writeFile(MISMATCH_PATH, JSON.stringify(mismatches, null, 2), "utf8");

  const importedByIds = oldBookings.map((b) => b.id).filter(Boolean);
  const importedCount = await prisma.booking.count({
    where: { id: { in: importedByIds }, orgId: TARGET_ORG_ID },
  });

  const summary = {
    mode: isDryRun ? "dry-run" : "apply",
    oldBaseUrl: OLD_BASE_URL,
    targetOrgId: TARGET_ORG_ID,
    sourceBookingCount: oldBookings.length,
    sourceSitterCount: oldSitters.length,
    sitterSync,
    created,
    skippedFromCheckpoint: skipped,
    duplicateSame,
    duplicateDifferent,
    failures: failures.length,
    mismatches: mismatches.length,
    importedCountInTargetByLegacyIds: importedCount,
    finishedAt: new Date().toISOString(),
  };

  await fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2), "utf8");

  await appendLog({
    at: new Date().toISOString(),
    level: "info",
    code: "migration.complete",
    details: summary as unknown as Record<string, unknown>,
  });

  console.log(JSON.stringify(summary, null, 2));

  await prisma.$disconnect();

  if (isApply && failures.length > 0) {
    process.exitCode = 2;
  }
}

run().catch(async (error) => {
  console.error(error);
  await appendLog({
    at: new Date().toISOString(),
    level: "error",
    code: "migration.fatal",
    details: { message: error instanceof Error ? error.message : String(error) },
  }).catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

