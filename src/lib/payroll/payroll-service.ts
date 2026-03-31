/**
 * Payroll Service
 *
 * Computes payroll from PayoutTransfer + Booking + Sitter (single source of truth).
 * Creates/updates PayrollRun records scoped by orgId.
 */

import type { PrismaClient } from '@prisma/client';

export interface PayrollPeriod {
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface PayrollComputation {
  sitterId: string;
  sitterName: string;
  bookingCount: number;
  totalEarnings: number;
  commissionRate: number;
  commissionAmount: number;
  adjustments: number;
  netAmount: number;
  bookings: Array<{
    bookingId: string;
    bookingDate: Date;
    service: string;
    totalPrice: number;
    commissionPercentage: number;
    commissionAmount: number;
  }>;
}

/** Monday 00:00:00 UTC for the week containing d */
export function getWeekStart(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

/** Sunday 23:59:59.999 UTC for the week containing d */
export function getWeekEnd(d: Date): Date {
  const start = getWeekStart(d);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/**
 * Generate pay periods (weekly or biweekly)
 */
export function generatePayPeriods(
  startDate: Date,
  endDate: Date,
  frequency: 'weekly' | 'biweekly' = 'biweekly'
): PayrollPeriod[] {
  const periods: PayrollPeriod[] = [];
  const current = new Date(startDate);
  const days = frequency === 'weekly' ? 7 : 14;

  while (current < endDate) {
    const periodStart = new Date(current);
    const periodEnd = new Date(current);
    periodEnd.setDate(periodEnd.getDate() + days - 1);
    if (periodEnd > endDate) periodEnd.setTime(endDate.getTime());
    periods.push({
      startDate: periodStart,
      endDate: periodEnd,
      label: `${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}`,
    });
    current.setDate(current.getDate() + days);
  }
  return periods;
}

/**
 * Persist a PayrollRun + PayrollLineItem when a PayoutTransfer is created.
 * Call from the payout worker after a successful (or recorded) transfer.
 * Idempotent: if a line item with this payoutTransferId exists, skips.
 */
export async function persistPayrollRunFromTransfer(
  db: PrismaClient,
  orgId: string,
  payoutTransferId: string,
  sitterId: string,
  totalEarnings: number,
  commissionAmount: number,
  netAmount: number
): Promise<void> {
  const existingLine = await db.payrollLineItem.findFirst({
    where: { payoutTransferId },
  });
  if (existingLine) return;

  const transfer = await db.payoutTransfer.findFirst({
    where: { id: payoutTransferId, orgId },
  });
  if (!transfer) return;

  const periodStart = getWeekStart(transfer.createdAt);
  const periodEnd = getWeekEnd(transfer.createdAt);
  const commissionRate = totalEarnings > 0
    ? Math.round((100 * (1 - netAmount / totalEarnings)) * 100) / 100
    : 0;

  let run = await db.payrollRun.findFirst({
    where: { orgId, payPeriodStart: periodStart, payPeriodEnd: periodEnd },
  });
  if (!run) {
    run = await db.payrollRun.create({
      data: {
        orgId,
        payPeriodStart: periodStart,
        payPeriodEnd: periodEnd,
        status: 'pending',
        totalAmount: netAmount,
        totalSitters: 1,
      },
    });
  } else {
    const lineCount = await db.payrollLineItem.count({ where: { payrollRunId: run.id } });
    const distinctSitters = await db.payrollLineItem.findMany({
      where: { payrollRunId: run.id },
      select: { sitterId: true },
      distinct: ['sitterId'],
    });
    const newSitter = !distinctSitters.some((s) => s.sitterId === sitterId);
    await db.payrollRun.update({
      where: { id: run.id },
      data: {
        totalAmount: run.totalAmount + netAmount,
        totalSitters: newSitter ? run.totalSitters + 1 : run.totalSitters,
      },
    });
  }

  await db.payrollLineItem.create({
    data: {
      payrollRunId: run.id,
      sitterId,
      payoutTransferId,
      bookingCount: 1,
      totalEarnings,
      commissionRate,
      commissionAmount,
      netAmount,
    },
  });
}

/**
 * Backfill: create PayrollRun + PayrollLineItem for transfers that don't have a line yet.
 * Use when listing so legacy data gets runs. New transfers get run+line from worker.
 */
export async function backfillPayrollRunsFromTransfers(
  db: PrismaClient,
  orgId: string
): Promise<void> {
  const transfers = await db.payoutTransfer.findMany({
    where: { orgId },
    orderBy: { createdAt: 'asc' },
  });
  for (const t of transfers) {
    const hasLine = await db.payrollLineItem.findFirst({
      where: { payoutTransferId: t.id },
    });
    if (hasLine) continue;
    const netAmount = t.amount / 100;
    const booking = t.bookingId
      ? await db.booking.findUnique({
          where: { id: t.bookingId },
          select: { totalPrice: true },
        })
      : null;
    const totalEarnings = booking ? Number(booking.totalPrice) || 0 : netAmount;
    const commissionAmount = Math.max(0, totalEarnings - netAmount);
    await persistPayrollRunFromTransfer(db, orgId, t.id, t.sitterId, totalEarnings, commissionAmount, netAmount);
  }
}

/**
 * Ensure PayrollRun records exist for every week that has PayoutTransfers (legacy path).
 * Prefer backfillPayrollRunsFromTransfers so each transfer gets a line item.
 */
export async function ensurePayrollRunsFromTransfers(
  db: PrismaClient,
  orgId: string
): Promise<void> {
  await backfillPayrollRunsFromTransfers(db, orgId);
}

/**
 * List payroll runs for org (after ensuring runs from transfers).
 */
export async function listPayrollRuns(
  db: PrismaClient,
  orgId: string
): Promise<
  Array<{
    id: string;
    startDate: string;
    endDate: string;
    sitterCount: number;
    totalPayout: number;
    status: string;
  }>
> {
  await ensurePayrollRunsFromTransfers(db, orgId);
  const runs = await db.payrollRun.findMany({
    where: { orgId },
    orderBy: { payPeriodStart: 'desc' },
    take: 52,
  });
  return runs.map((r) => ({
    id: r.id,
    startDate: r.payPeriodStart.toISOString(),
    endDate: r.payPeriodEnd.toISOString(),
    sitterCount: r.totalSitters,
    totalPayout: r.totalAmount,
    status: r.status,
  }));
}

export interface PayrollRunBookingLine {
  bookingId: string;
  bookingDate: string;
  service: string;
  totalPrice: number;
  commissionPercentage: number;
  commissionAmount: number;
  status: string;
}

/**
 * Get run detail + sitters aggregated from PayoutTransfer + Booking + Sitter for that period.
 */
export async function getPayrollRunDetail(
  db: PrismaClient,
  orgId: string,
  runId: string
): Promise<{
  run: { id: string; startDate: string; endDate: string; status: string; totalPayout: number };
  sitters: Array<{
    sitterId: string;
    sitterName: string;
    bookingCount: number;
    earnings: number;
    commission: number;
    payoutAmount: number;
    stripeAccount: boolean;
  }>;
  bookings: PayrollRunBookingLine[];
} | null> {
  const run = await db.payrollRun.findFirst({
    where: { id: runId, orgId },
  });
  if (!run) return null;

  const periodStart = run.payPeriodStart;
  const periodEnd = run.payPeriodEnd;

  const transfers = await db.payoutTransfer.findMany({
    where: {
      orgId,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    include: {
      sitter: {
        select: { id: true, firstName: true, lastName: true, commissionPercentage: true },
      },
    },
  });

  const bySitter = new Map<
    string,
    { payoutCents: number; bookingIds: Set<string>; sitter: (typeof transfers)[0]['sitter'] }
  >();
  for (const t of transfers) {
    const sid = t.sitterId;
    if (!bySitter.has(sid)) {
      bySitter.set(sid, { payoutCents: 0, bookingIds: new Set(), sitter: t.sitter });
    }
    const row = bySitter.get(sid)!;
    row.payoutCents += t.amount;
    if (t.bookingId) row.bookingIds.add(t.bookingId);
  }

  const sitterIds = Array.from(bySitter.keys());
  const bookingsRaw =
    sitterIds.length > 0
      ? await db.booking.findMany({
          where: {
            orgId,
            sitterId: { in: sitterIds },
            status: 'completed',
            endAt: { gte: periodStart, lte: periodEnd },
          },
          select: {
            id: true,
            sitterId: true,
            totalPrice: true,
            endAt: true,
            service: true,
          },
          orderBy: { endAt: 'asc' },
        })
      : [];

  const sitterPct = new Map<string, number>();
  for (const t of transfers) {
    if (t.sitter?.commissionPercentage != null) {
      sitterPct.set(t.sitterId, t.sitter.commissionPercentage);
    }
  }

  const bookings: PayrollRunBookingLine[] = bookingsRaw.map((b) => {
    const totalPrice = Number(b.totalPrice) || 0;
    const pct = sitterPct.get(b.sitterId!) ?? 80;
    const commissionAmount = totalPrice * (1 - pct / 100);
    return {
      bookingId: b.id,
      bookingDate: b.endAt.toISOString(),
      service: b.service ?? 'Visit',
      totalPrice: Math.round(totalPrice * 100) / 100,
      commissionPercentage: pct,
      commissionAmount: Math.round(commissionAmount * 100) / 100,
      status: 'completed',
    };
  });

  const grossBySitter = new Map<string, number>();
  for (const b of bookingsRaw) {
    const g = Number(b.totalPrice) || 0;
    grossBySitter.set(b.sitterId!, (grossBySitter.get(b.sitterId!) ?? 0) + g);
  }

  const stripeAccounts = await db.sitterStripeAccount.findMany({
    where: { orgId, sitterId: { in: sitterIds } },
    select: { sitterId: true },
  });
  const hasStripe = new Set(stripeAccounts.map((a) => a.sitterId));

  const sitters = Array.from(bySitter.entries()).map(([sitterId, row]) => {
    const gross = grossBySitter.get(sitterId) ?? 0;
    const payoutAmount = row.payoutCents / 100;
    const commission = Math.max(0, gross - payoutAmount);
    const sitterName =
      row.sitter &&
      [row.sitter.firstName, row.sitter.lastName].filter(Boolean).join(' ').trim();
    return {
      sitterId,
      sitterName: sitterName || `Sitter ${sitterId.slice(0, 8)}`,
      bookingCount: row.bookingIds.size,
      earnings: Math.round(gross * 100) / 100,
      commission: Math.round(commission * 100) / 100,
      payoutAmount: Math.round(payoutAmount * 100) / 100,
      stripeAccount: hasStripe.has(sitterId),
    };
  });

  return {
    run: {
      id: run.id,
      startDate: run.payPeriodStart.toISOString(),
      endDate: run.payPeriodEnd.toISOString(),
      status: run.status,
      totalPayout: run.totalAmount,
    },
    sitters,
    bookings,
  };
}

/**
 * Approve a payroll run (owner/admin only). Run must be status 'pending'.
 */
export async function approvePayrollRun(
  db: PrismaClient,
  orgId: string,
  runId: string,
  approvedBy: string
): Promise<boolean> {
  const run = await db.payrollRun.findFirst({
    where: { id: runId, orgId },
  });
  if (!run || run.status !== 'pending') return false;
  await db.payrollRun.update({
    where: { id: runId },
    data: { status: 'approved', approvedBy, approvedAt: new Date() },
  });
  return true;
}

export interface PayrollExportRow {
  sitterName: string;
  earnings: number;
  commission: number;
  payoutAmount: number;
  stripeAccount: string;
  bookingCount: number;
}

/**
 * Get export rows for a payroll run (CSV: sitter name, earnings, commission, payout amount, stripe account, booking count).
 */
export async function getPayrollRunExportRows(
  db: PrismaClient,
  orgId: string,
  runId: string
): Promise<PayrollExportRow[] | null> {
  const detail = await getPayrollRunDetail(db, orgId, runId);
  if (!detail) return null;
  return detail.sitters.map((s) => ({
    sitterName: s.sitterName,
    earnings: s.earnings,
    commission: s.commission,
    payoutAmount: s.payoutAmount,
    stripeAccount: s.stripeAccount ? 'Yes' : 'No',
    bookingCount: s.bookingCount,
  }));
}

/**
 * Compute payroll for a specific period (from bookings + sitters). Used for export and line items.
 */
export async function computePayrollForPeriod(
  db: PrismaClient,
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<PayrollComputation[]> {
  const bookings = await db.booking.findMany({
    where: {
      orgId,
      status: 'completed',
      endAt: { gte: startDate, lte: endDate },
      sitterId: { not: null },
    },
    include: { sitter: { select: { id: true, firstName: true, lastName: true, commissionPercentage: true } } },
    orderBy: { endAt: 'asc' },
  });

  const bySitter = new Map<
    string,
    {
      sitterName: string;
      commissionPct: number;
      bookings: PayrollComputation['bookings'];
      totalEarnings: number;
      commissionAmount: number;
    }
  >();
  for (const b of bookings) {
    const sid = b.sitterId!;
    const sitter = b.sitter;
    const totalPrice = Number(b.totalPrice) || 0;
    const pct = sitter?.commissionPercentage ?? 80;
    const commissionAmount = totalPrice * (1 - pct / 100);
    const netAmount = totalPrice - commissionAmount;
    if (!bySitter.has(sid)) {
      bySitter.set(sid, {
        sitterName:
          sitter &&
          [sitter.firstName, sitter.lastName].filter(Boolean).join(' ').trim() ||
          `Sitter ${sid.slice(0, 8)}`,
        commissionPct: pct,
        bookings: [],
        totalEarnings: 0,
        commissionAmount: 0,
      });
    }
    const row = bySitter.get(sid)!;
    row.bookings.push({
      bookingId: b.id,
      bookingDate: b.endAt,
      service: b.service ?? 'Visit',
      totalPrice,
      commissionPercentage: pct,
      commissionAmount,
    });
    row.totalEarnings += totalPrice;
    row.commissionAmount += commissionAmount;
  }

  return Array.from(bySitter.entries()).map(([sitterId, row]) => ({
    sitterId,
    sitterName: row.sitterName,
    bookingCount: row.bookings.length,
    totalEarnings: Math.round(row.totalEarnings * 100) / 100,
    commissionRate: row.commissionPct,
    commissionAmount: Math.round(row.commissionAmount * 100) / 100,
    adjustments: 0,
    netAmount: Math.round((row.totalEarnings - row.commissionAmount) * 100) / 100,
    bookings: row.bookings,
  }));
}

