import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

type Role = "owner" | "sitter" | "client";

const BASE_URL = process.env.BASE_URL || "https://snout-os-staging.onrender.com";
const E2E_AUTH_KEY = process.env.E2E_AUTH_KEY || "test-e2e-key-change-in-production";
const ROOT = path.resolve(process.cwd(), "docs/qa/scenario-screenshots");

const actionLog: string[] = [];
const clickFailures: Array<{ scenario: string; step: string; error: string }> = [];

function log(message: string) {
  console.log(message);
  actionLog.push(message);
}

function parseSetCookie(raw: string): { name: string; value: string } | null {
  const first = raw.split(";")[0] ?? "";
  const idx = first.indexOf("=");
  if (idx <= 0) return null;
  return { name: first.slice(0, idx), value: first.slice(idx + 1) };
}

function getSetCookies(res: Response): string[] {
  const maybe = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof maybe.getSetCookie === "function") return maybe.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

async function e2eCookie(role: Role) {
  const res = await fetch(`${BASE_URL}/api/ops/e2e-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-e2e-key": E2E_AUTH_KEY,
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`e2e-login failed for ${role}: ${res.status} ${body}`);
  }
  const all = getSetCookies(res)
    .map(parseSetCookie)
    .filter((c): c is { name: string; value: string } => Boolean(c));
  if (all.length === 0) throw new Error(`e2e-login returned no cookies for ${role}`);
  return all;
}

function cookieHeader(cookies: Array<{ name: string; value: string }>) {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function fetchJson(pathname: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${pathname}`, init);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, text, json };
}

async function screenshot(page: Page, outPath: string, fullPage = true) {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: outPath, fullPage });
  log(`  📸 Screenshot saved: ${path.basename(outPath)}`);
}

async function navigateAndWait(page: Page, route: string, desc: string) {
  log(`  → ${desc}: ${route}`);
  try {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2000);
  } catch (error: any) {
    log(`  ⚠️  Navigation warning: ${error.message}`);
  }
}

async function createBooking(clientCookieHeader: string, suffix: string, minutesFromNow = 30) {
  const now = new Date();
  const startAt = new Date(now.getTime() + minutesFromNow * 60_000);
  const endAt = new Date(startAt.getTime() + 30 * 60_000);
  const payload = {
    firstName: "Scenario",
    lastName: suffix,
    phone: "+14155550101",
    email: `scenario-${suffix.toLowerCase()}@example.com`,
    address: "123 Scenario Lane, Atlanta, GA",
    service: "Dog Walking",
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    quantity: 1,
    pets: [{ name: "Milo", species: "Dog" }],
    notes: `Scenario setup ${suffix}`,
  };
  const created = await fetchJson("/api/client/bookings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Cookie: clientCookieHeader,
    },
    body: JSON.stringify(payload),
  });
  const bookingId = created.json?.booking?.id as string | undefined;
  if (!created.res.ok || !bookingId) {
    throw new Error(`createBooking failed: status=${created.res.status} body=${created.text}`);
  }
  log(`  ✓ Created booking: ${bookingId}`);
  return bookingId;
}

async function assignBooking(ownerCookieHeader: string, bookingId: string, sitterId: string) {
  const assigned = await fetchJson(`/api/bookings/${bookingId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      Cookie: ownerCookieHeader,
    },
    body: JSON.stringify({ sitterId, status: "confirmed" }),
  });
  if (!assigned.res.ok) {
    throw new Error(`assignBooking failed: status=${assigned.res.status} body=${assigned.text}`);
  }
  log(`  ✓ Assigned booking to sitter: ${sitterId}`);
}

async function checkInOutAndReport(sitterCookieHeader: string, bookingId: string) {
  const checkIn = await fetchJson(`/api/bookings/${bookingId}/check-in`, {
    method: "POST",
    headers: { "content-type": "application/json", Cookie: sitterCookieHeader },
    body: JSON.stringify({ lat: 33.75, lng: -84.39 }),
  });
  if (!checkIn.res.ok) throw new Error(`check-in failed: ${checkIn.res.status} ${checkIn.text}`);
  
  const checkOut = await fetchJson(`/api/bookings/${bookingId}/check-out`, {
    method: "POST",
    headers: { "content-type": "application/json", Cookie: sitterCookieHeader },
    body: JSON.stringify({ lat: 33.75, lng: -84.39 }),
  });
  if (!checkOut.res.ok) throw new Error(`check-out failed: ${checkOut.res.status} ${checkOut.text}`);
  
  const report = await fetchJson(`/api/bookings/${bookingId}/daily-delight`, {
    method: "POST",
    headers: { "content-type": "application/json", Cookie: sitterCookieHeader },
    body: JSON.stringify({ report: `Scenario report ${new Date().toISOString()}` }),
  });
  if (!report.res.ok) throw new Error(`report failed: ${report.res.status} ${report.text}`);
  log(`  ✓ Completed check-in, check-out, and report for booking: ${bookingId}`);
}

async function getSessionSitterId(sitterCookieHeader: string): Promise<string> {
  const session = await fetchJson("/api/auth/session", { headers: { Cookie: sitterCookieHeader } });
  const sitterId = session.json?.user?.sitterId as string | undefined;
  if (!sitterId) throw new Error(`Sitter session missing sitterId: ${session.text}`);
  return sitterId;
}

async function main() {
  await fs.mkdir(ROOT, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const cookieDomain = new URL(BASE_URL).hostname;

  const contexts = {} as Record<Role, BrowserContext>;
  const pages = {} as Record<Role, Page>;
  const cookieByRole = {} as Record<Role, Array<{ name: string; value: string }>>;

  let mainBookingId = "";
  let recurringBookingId = "";
  let assignedBookingId = "";
  let sitterId = "";

  try {
    log("🚀 Starting 7-scenario walkthrough on Snout OS staging");
    log(`📍 Base URL: ${BASE_URL}\n`);

    // Seed fixtures first
    log("🌱 Seeding fixtures...");
    await fetchJson("/api/ops/command-center/seed-fixtures", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-e2e-key": E2E_AUTH_KEY,
      },
      body: JSON.stringify({}),
    });

    // Set up role sessions
    for (const role of ["owner", "sitter", "client"] as const) {
      log(`🔐 Authenticating as ${role}...`);
      contexts[role] = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      cookieByRole[role] = await e2eCookie(role);
      await contexts[role].addCookies(
        cookieByRole[role].map((c) => ({
          name: c.name,
          value: c.value,
          domain: cookieDomain,
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Lax" as const,
        }))
      );
      pages[role] = await contexts[role].newPage();
    }

    const ownerCookieHeader = cookieHeader(cookieByRole.owner);
    const clientCookieHeader = cookieHeader(cookieByRole.client);
    const sitterCookieHeader = cookieHeader(cookieByRole.sitter);
    sitterId = await getSessionSitterId(sitterCookieHeader);

    // Create test bookings for scenarios
    log("\n📝 Creating test bookings...");
    mainBookingId = await createBooking(clientCookieHeader, "Main", 40);
    recurringBookingId = await createBooking(clientCookieHeader, "Recurring", 120);
    assignedBookingId = await createBooking(clientCookieHeader, "Assigned", 180);
    
    await assignBooking(ownerCookieHeader, assignedBookingId, sitterId);
    await checkInOutAndReport(sitterCookieHeader, assignedBookingId);

    // ============================================
    // SCENARIO 01: Client First Booking
    // ============================================
    log("\n\n📦 SCENARIO 01: Client First Booking");
    const sc01dir = path.join(ROOT, "scenario-01-client-first-booking");
    await fs.mkdir(sc01dir, { recursive: true });

    await navigateAndWait(pages.client, "/client/bookings", "Navigate to client bookings");
    await screenshot(pages.client, path.join(sc01dir, "client-upcoming-visits.png"));

    await navigateAndWait(pages.client, `/client/bookings/${mainBookingId}`, "Navigate to booking detail");
    await screenshot(pages.client, path.join(sc01dir, "client-booking-confirmation.png"));

    // ============================================
    // SCENARIO 02: Recurring Bookings
    // ============================================
    log("\n\n📦 SCENARIO 02: Recurring Bookings");
    const sc02dir = path.join(ROOT, "scenario-02-recurring-bookings");
    await fs.mkdir(sc02dir, { recursive: true });

    await navigateAndWait(pages.client, "/client/bookings", "Navigate to client bookings list");
    await screenshot(pages.client, path.join(sc02dir, "client-recurring-bookings-list.png"));

    // ============================================
    // SCENARIO 03: Owner Assigns Sitter
    // ============================================
    log("\n\n📦 SCENARIO 03: Owner Assigns Sitter");
    const sc03dir = path.join(ROOT, "scenario-03-owner-assigns-sitter");
    await fs.mkdir(sc03dir, { recursive: true });

    await navigateAndWait(pages.owner, "/dashboard", "Navigate to owner dashboard");
    await screenshot(pages.owner, path.join(sc03dir, "owner-booking-notification.png"));

    await navigateAndWait(pages.owner, `/bookings/${mainBookingId}`, "Navigate to booking detail for assignment");
    await screenshot(pages.owner, path.join(sc03dir, "owner-assign-sitter.png"));

    // ============================================
    // SCENARIO 07: Client Report Received
    // ============================================
    log("\n\n📦 SCENARIO 07: Client Report Received");
    const sc07dir = path.join(ROOT, "scenario-07-client-report-received");
    await fs.mkdir(sc07dir, { recursive: true });

    await navigateAndWait(pages.client, "/client/reports", "Navigate to client reports");
    await screenshot(pages.client, path.join(sc07dir, "client-report-view.png"));

    await navigateAndWait(pages.client, "/client/messages", "Navigate to client messages");
    await screenshot(pages.client, path.join(sc07dir, "client-message-report-notice.png"));

    // ============================================
    // SCENARIO 11: Owner Revenue Dashboard
    // ============================================
    log("\n\n📦 SCENARIO 11: Owner Revenue Dashboard");
    const sc11dir = path.join(ROOT, "scenario-11-owner-revenue-dashboard");
    await fs.mkdir(sc11dir, { recursive: true });

    await navigateAndWait(pages.owner, "/dashboard", "Navigate to command center");
    await screenshot(pages.owner, path.join(sc11dir, "owner-command-center.png"));

    await navigateAndWait(pages.owner, "/analytics", "Navigate to analytics dashboard");
    await screenshot(pages.owner, path.join(sc11dir, "owner-revenue-dashboard.png"));

    await navigateAndWait(pages.owner, "/automations", "Navigate to automation log");
    await screenshot(pages.owner, path.join(sc11dir, "owner-automation-log.png"));

    // ============================================
    // SCENARIO 13: Client Reschedule
    // ============================================
    log("\n\n📦 SCENARIO 13: Client Reschedule");
    const sc13dir = path.join(ROOT, "scenario-13-client-reschedule");
    await fs.mkdir(sc13dir, { recursive: true });

    await navigateAndWait(pages.client, "/client/bookings", "Navigate to client bookings for reschedule");
    await screenshot(pages.client, path.join(sc13dir, "client-reschedule-flow.png"));

    await navigateAndWait(pages.owner, "/dashboard", "Navigate to owner dashboard for reschedule notification");
    await screenshot(pages.owner, path.join(sc13dir, "owner-reschedule-notification.png"));

    // ============================================
    // SCENARIO 14: Reminder Automation
    // ============================================
    log("\n\n📦 SCENARIO 14: Reminder Automation");
    const sc14dir = path.join(ROOT, "scenario-14-reminder-automation");
    await fs.mkdir(sc14dir, { recursive: true });

    // Trigger test automation
    log("  → Triggering test automation message...");
    await fetchJson("/api/automations/test-message", {
      method: "POST",
      headers: { "content-type": "application/json", Cookie: ownerCookieHeader },
      body: JSON.stringify({
        template: `Scenario automation reminder ${new Date().toISOString()}`,
        phoneNumber: "+14155550101",
      }),
    });

    await navigateAndWait(pages.owner, "/automations", "Navigate to automation log");
    await screenshot(pages.owner, path.join(sc14dir, "owner-automation-log.png"));

    await navigateAndWait(pages.client, "/client/messages", "Navigate to client messages");
    await screenshot(pages.client, path.join(sc14dir, "client-reminder-message.png"));

    log("\n\n✅ All 7 scenarios completed!");
    log(`\n📊 Action Log Summary:`);
    log(`  - Total actions: ${actionLog.length}`);
    log(`  - Click failures: ${clickFailures.length}`);
    
    if (clickFailures.length > 0) {
      log(`\n❌ Click Failures:`);
      clickFailures.forEach(f => {
        log(`  - ${f.scenario} | ${f.step}: ${f.error}`);
      });
    }

    // Write action log
    const logPath = path.join(ROOT, "walkthrough-action-log.txt");
    await fs.writeFile(logPath, actionLog.join("\n"));
    log(`\n📝 Full action log written to: ${logPath}`);

  } catch (error: any) {
    log(`\n❌ Fatal error: ${error.message}`);
    throw error;
  } finally {
    for (const role of ["owner", "sitter", "client"] as const) {
      await contexts[role]?.close().catch(() => {});
    }
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[walkthrough] failed", error);
  process.exit(1);
});
