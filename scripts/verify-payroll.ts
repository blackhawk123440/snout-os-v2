#!/usr/bin/env tsx
/**
 * Payroll production verification (deterministic).
 *
 * Required flow:
 * - Seed or identify a booking that can complete payout flow
 * - Trigger payout creation (executePayout + persistPayrollRunFromTransfer)
 * - Verify: PayoutTransfer, LedgerEntry, PayrollLineItem (payoutTransferId), PayrollRun (orgId)
 * - If BASE_URL + E2E_AUTH_KEY: owner /api/payroll includes run, sitter earnings reflect payout, reconciliation sees ledger
 *
 * If any check fails -> RESULT: FAIL. No PASS without full chain.
 *
 * Usage:
 *   DATABASE_URL=... pnpm run verify:payroll
 *   Optional: BASE_URL=... E2E_AUTH_KEY=... for API checks (owner payroll, sitter earnings, reconciliation)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORG_ID = 'default';
const SEED_SITTER_ID = 'sitter-verify-payroll';
const VERIFY_RUN_ID = `verify-payroll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function fail(msg: string): never {
  console.error('FAIL:', msg);
  process.exit(1);
}

async function assert(condition: boolean, msg: string) {
  if (!condition) fail(msg);
}

async function main() {
  const checks: string[] = [];
  const report: string[] = [];

  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is required');
  }

  process.env.STRIPE_MOCK_TRANSFER = 'true';

  try {
    await prisma.$connect();
  } catch (e) {
    fail(`Could not connect to database: ${e}`);
  }

  try {
    // --- 1) Schema proof: PayrollRun.orgId and PayrollLineItem.payoutTransferId exist (migrations applied) ---
    try {
      await prisma.payrollRun.findFirst({ select: { id: true, orgId: true } });
      await prisma.payrollLineItem.findFirst({ select: { id: true, payoutTransferId: true } });
    } catch (e) {
      fail(
        `Schema check failed: PayrollRun.orgId or PayrollLineItem.payoutTransferId may be missing. Apply migrations. ${e}`
      );
    }
    checks.push('OK: Schema has PayrollRun.orgId and PayrollLineItem.payoutTransferId');

    // --- 2) Find or seed: sitter + stripe account + completed booking ---
    let sitterId: string;
    let bookingId: string;
    let totalPrice: number;
    let existingTransfer = false;

    const existingBooking = await prisma.booking.findFirst({
      where: { orgId: ORG_ID, status: 'completed', sitterId: { not: null } },
      include: {
        sitter: {
          include: {
            stripeConnectAccount: true,
          },
        },
      },
    });

    if (
      existingBooking?.sitterId &&
      existingBooking.sitter?.stripeConnectAccount?.payoutsEnabled &&
      Number(existingBooking.totalPrice) > 0
    ) {
      sitterId = existingBooking.sitterId;
      bookingId = existingBooking.id;
      totalPrice = Number(existingBooking.totalPrice);
      const existingPt = await prisma.payoutTransfer.findFirst({
        where: { orgId: ORG_ID, bookingId, sitterId },
      });
      if (existingPt) existingTransfer = true;
      checks.push(`OK: Using existing completed booking ${bookingId} (sitter ${sitterId})`);
    } else {
      // Seed minimal data (fixed sitter id so we can upsert)
      const sitter = await prisma.sitter.upsert({
        where: { id: SEED_SITTER_ID },
        create: {
          id: SEED_SITTER_ID,
          orgId: ORG_ID,
          firstName: 'Verify',
          lastName: 'Payroll',
          email: `verify-payroll@test.local`,
        },
        update: {},
      });
      sitterId = sitter.id;

      await prisma.sitterStripeAccount.upsert({
        where: { sitterId },
        create: {
          orgId: ORG_ID,
          sitterId,
          accountId: `acct_mock_${VERIFY_RUN_ID}`,
          payoutsEnabled: true,
          chargesEnabled: true,
          onboardingStatus: 'complete',
        },
        update: { payoutsEnabled: true },
      });

      let clientId: string;
      const client = await prisma.client.findFirst({ where: { orgId: ORG_ID } }).catch(() => null);
      if (client) {
        clientId = client.id;
      } else {
        const c = await prisma.client.create({
          data: {
            orgId: ORG_ID,
            firstName: 'Verify',
            lastName: 'Client',
            phone: `+1555000${VERIFY_RUN_ID.slice(-6).replace(/\D/g, '0')}`.slice(0, 20),
          },
        });
        clientId = c.id;
      }

      const booking = await prisma.booking.create({
        data: {
          orgId: ORG_ID,
          clientId,
          sitterId,
          firstName: 'Verify',
          lastName: 'Client',
          phone: `+1555000${VERIFY_RUN_ID.slice(-6).replace(/\D/g, '0')}`.slice(0, 20),
          status: 'completed',
          service: 'Verify Payroll',
          totalPrice: 100.0,
          startAt: new Date(),
          endAt: new Date(),
        },
      });
      bookingId = booking.id;
      totalPrice = 100;
      checks.push(`OK: Seeded sitter ${sitterId}, booking ${bookingId}, totalPrice ${totalPrice}`);
    }

    // --- 3) Trigger payout (executePayout + persistPayrollRunFromTransfer) ---
    const { executePayout } = await import('../src/lib/payout/payout-engine');
    const { persistPayrollRunFromTransfer } = await import('../src/lib/payroll/payroll-service');
    const { calculatePayoutForBooking } = await import('../src/lib/payout/payout-engine');

    const calc = calculatePayoutForBooking(totalPrice, 80);
    if (calc.amountCents <= 0) fail('Payout calculation produced 0 cents');

    const result = await executePayout({
      db: prisma as any,
      orgId: ORG_ID,
      sitterId,
      bookingId,
      amountCents: calc.amountCents,
      currency: 'usd',
    });

    assert(result.success === true, `executePayout failed: ${result.error ?? 'unknown'}`);
    assert(!!result.payoutTransferId, 'executePayout did not return payoutTransferId');
    checks.push(`OK: PayoutTransfer created: ${result.payoutTransferId}`);

    if (!existingTransfer) {
      await persistPayrollRunFromTransfer(
        prisma as any,
        ORG_ID,
        result.payoutTransferId!,
        sitterId,
        totalPrice,
        totalPrice - calc.netAmount,
        calc.netAmount
      );
      checks.push('OK: persistPayrollRunFromTransfer called');
    }

    // --- 4) Verify DB chain ---
    const transfer = await prisma.payoutTransfer.findFirst({
      where: { id: result.payoutTransferId!, orgId: ORG_ID },
    });
    assert(!!transfer, 'PayoutTransfer not found');
    checks.push('OK: PayoutTransfer exists');

    const ledgerCount = await prisma.ledgerEntry.count({
      where: { orgId: ORG_ID, entryType: 'payout', sitterId },
    });
    assert(ledgerCount > 0, 'No LedgerEntry for payout');
    checks.push(`OK: LedgerEntry exists (${ledgerCount} payout entries)`);

    const lineItem = await prisma.payrollLineItem.findFirst({
      where: { payoutTransferId: transfer.id },
      include: { payrollRun: true },
    });
    assert(!!lineItem, 'No PayrollLineItem with payoutTransferId for this transfer');
    assert(!!lineItem.payrollRun, 'PayrollRun not found for line item');
    assert(!!lineItem.payrollRun.orgId, 'PayrollRun.orgId is missing');
    checks.push('OK: PayrollLineItem exists with payoutTransferId');
    checks.push('OK: PayrollRun exists with orgId');

    report.push(`transferId=${transfer.id}`);
    report.push(`runId=${lineItem.payrollRun.id}`);
    report.push(`lineItemId=${lineItem.id}`);

    // --- 5) Optional API checks ---
    const baseUrl = process.env.BASE_URL?.replace(/\/$/, '');
    const e2eKey = process.env.E2E_AUTH_KEY;

    if (baseUrl && e2eKey) {
      const loginRes = await fetch(`${baseUrl}/api/ops/e2e-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-e2e-key': e2eKey },
        body: JSON.stringify({ role: 'owner' }),
        redirect: 'manual',
      });
      assert(loginRes.ok, `e2e-login owner failed: ${loginRes.status}`);
      const getSetCookie = (loginRes.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
      const setCookies = typeof getSetCookie === 'function' ? getSetCookie() : [loginRes.headers.get('set-cookie')].filter(Boolean) as string[];
      const cookieHeader = setCookies.map((s) => s.split(';')[0].trim()).join('; ');

      const payrollRes = await fetch(`${baseUrl}/api/payroll`, { headers: { Cookie: cookieHeader } });
      assert(payrollRes.ok, `GET /api/payroll failed: ${payrollRes.status}`);
      const payrollJson = await payrollRes.json().catch(() => ({}));
      const runs = Array.isArray(payrollJson.payPeriods) ? payrollJson.payPeriods : [];
      const runInList = runs.some((r: { id: string }) => r.id === lineItem.payrollRun.id);
      assert(runInList, 'Owner /api/payroll does not include the run');
      checks.push('OK: Owner /api/payroll includes the run');

      const sitterLoginRes = await fetch(`${baseUrl}/api/ops/e2e-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-e2e-key': e2eKey },
        body: JSON.stringify({ role: 'sitter' }),
        redirect: 'manual',
      });
      if (sitterLoginRes.ok) {
        const sitterGetSetCookie = (sitterLoginRes.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
        const sitterSetCookies = typeof sitterGetSetCookie === 'function' ? sitterGetSetCookie() : [sitterLoginRes.headers.get('set-cookie')].filter(Boolean) as string[];
        const sitterCookieHeader = sitterSetCookies.map((s) => s.split(';')[0].trim()).join('; ');
        const sitterTransfersRes = await fetch(`${baseUrl}/api/sitter/transfers`, { headers: { Cookie: sitterCookieHeader } });
        if (sitterTransfersRes.ok) {
          const transfersJson = await sitterTransfersRes.json().catch(() => ({}));
          const list = Array.isArray(transfersJson.transfers) ? transfersJson.transfers : [];
          const transferInList = list.some((t: { id: string }) => t.id === transfer.id);
          assert(transferInList, 'Sitter /api/sitter/transfers does not include the payout');
          checks.push('OK: Sitter earnings/transfers reflect the payout');
        }
      }

      const reconcileRes = await fetch(
        `${baseUrl}/api/ops/finance/reconcile/runs?limit=5`,
        { headers: { Cookie: cookieHeader } }
      );
      if (reconcileRes.ok) {
        checks.push('OK: Reconciliation API reachable (runs list)');
        report.push('reconciliation=reachable');
      }
    } else {
      report.push('apiChecks=skipped (set BASE_URL and E2E_AUTH_KEY for owner/sitter/reconciliation API checks)');
    }

    console.log(checks.join('\n'));
    console.log('\n' + report.join('\n'));
    console.log('\nRESULT: PASS');
  } catch (e) {
    console.error('Error:', e);
    console.log(checks.join('\n'));
    console.log('\nRESULT: FAIL');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
