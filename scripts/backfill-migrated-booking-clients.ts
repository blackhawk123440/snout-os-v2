/**
 * Targeted backfill: link migrated bookings to Client records.
 *
 * Why:
 * - Historical migrated bookings preserve booking fields, but OLD payload has clientId = null.
 * - Owner/client UI paths rely on booking.clientId relations for client profile linkage and portal visibility.
 *
 * Scope:
 * - Only bookings whose IDs exist in OLD /api/bookings export.
 * - Only rows in target org (default: "default").
 * - No booking core fields are modified besides clientId linkage.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type OldBooking = { id: string };
type OldBookingsResponse = { bookings: OldBooking[] };

const prisma = new PrismaClient();
const OLD_BASE_URL = process.env.OLD_DASHBOARD_URL || "https://backend-291r.onrender.com";
const TARGET_ORG_ID = process.env.MIGRATION_TARGET_ORG_ID || "default";

const OUT_DIR = path.join(process.cwd(), "docs", "internal", "audit", "artifacts", "booking-migration");
const REPORT_PATH = path.join(OUT_DIR, "client-link-backfill-summary.json");

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
  return (await res.json()) as T;
}

function normalize(v?: string | null) {
  const x = (v || "").trim();
  return x.length ? x : null;
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const old = await fetchJson<OldBookingsResponse>(`${OLD_BASE_URL}/api/bookings`);
  const oldIds = (old.bookings || []).map((b) => b.id).filter(Boolean);

  const targetBookings = await prisma.booking.findMany({
    where: {
      id: { in: oldIds },
      orgId: TARGET_ORG_ID,
    },
    select: {
      id: true,
      orgId: true,
      clientId: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      address: true,
    },
  });

  const toLink = targetBookings.filter((b) => !b.clientId);
  let linkedExisting = 0;
  let createdAndLinked = 0;
  let skippedNoPhone = 0;
  const unresolvedCrossOrg: Array<{ bookingId: string; phone: string; existingClientId: string; existingOrgId: string }> = [];

  for (const booking of toLink) {
    const phone = normalize(booking.phone);
    if (!phone) {
      skippedNoPhone += 1;
      continue;
    }

    const existingAnyOrg = await prisma.client.findFirst({
      where: { phone },
      select: { id: true, orgId: true },
    });

    if (existingAnyOrg) {
      if (existingAnyOrg.orgId === TARGET_ORG_ID) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { clientId: existingAnyOrg.id },
        });
        linkedExisting += 1;
      } else {
        unresolvedCrossOrg.push({
          bookingId: booking.id,
          phone,
          existingClientId: existingAnyOrg.id,
          existingOrgId: existingAnyOrg.orgId,
        });
      }
      continue;
    }

    const created = await prisma.client.create({
      data: {
        orgId: TARGET_ORG_ID,
        firstName: normalize(booking.firstName) || "",
        lastName: normalize(booking.lastName) || "",
        phone,
        email: normalize(booking.email),
        address: normalize(booking.address),
      },
      select: { id: true },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { clientId: created.id },
    });
    createdAndLinked += 1;
  }

  const stillUnlinked = await prisma.booking.count({
    where: {
      id: { in: oldIds },
      orgId: TARGET_ORG_ID,
      clientId: null,
    },
  });

  const summary = {
    oldBaseUrl: OLD_BASE_URL,
    targetOrgId: TARGET_ORG_ID,
    oldBookingIds: oldIds.length,
    targetBookingsMatched: targetBookings.length,
    attemptedToLink: toLink.length,
    linkedExisting,
    createdAndLinked,
    skippedNoPhone,
    unresolvedCrossOrgCount: unresolvedCrossOrg.length,
    unresolvedCrossOrg,
    stillUnlinked,
    finishedAt: new Date().toISOString(),
  };

  await fs.writeFile(REPORT_PATH, JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));

  await prisma.$disconnect();
  if (stillUnlinked > 0) process.exitCode = 2;
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

